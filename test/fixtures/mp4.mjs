// A minimal MP4 box tree for the site tests: ftyp, then moov with one video track whose
// sample description names the codec and coded size, and an mdat. It holds no frames;
// the site checks the container, codec, size and box order, not the pictures.
const box=(type,...parts)=>{const body=Buffer.concat(parts),head=Buffer.alloc(8);head.writeUInt32BE(8+body.length);head.write(type,4,'latin1');return Buffer.concat([head,body]);};

export function mp4({codec='avc1',width=1280,height=720,faststart=true}={}){
 const entry=Buffer.alloc(78);entry.writeUInt16BE(1,6);entry.writeUInt16BE(width,24);entry.writeUInt16BE(height,26);
 const hdlr=Buffer.alloc(25);hdlr.write('vide',8,'latin1');
 const stsd=Buffer.concat([Buffer.from([0,0,0,0,0,0,0,1]),box(codec,entry)]);
 const moov=box('moov',box('trak',box('mdia',box('hdlr',hdlr),box('minf',box('stbl',box('stsd',stsd))))));
 const ftyp=box('ftyp',Buffer.from('isom\0\0\x02\0isomavc1','latin1')),mdat=box('mdat',Buffer.alloc(16));
 return Buffer.concat(faststart?[ftyp,moov,mdat]:[ftyp,mdat,moov]);
}

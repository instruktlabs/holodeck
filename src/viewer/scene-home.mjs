// A shelf scene is served at <site>/worlds/<id>/. From that directory, two levels
// up is the shelf. A scene exported on its own has no shelf, so the name stays here.
export function sceneHomeHref(pathname='/'){
 let path=String(pathname);
 const index=/\/index\.html$/i.test(path);
 if(index)path=path.slice(0,-'index.html'.length);
 const directory=path.endsWith('/');
 const parts=path.split('/').filter(Boolean);
 if(parts.length>=2&&parts.at(-2)==='worlds'&&parts.at(-1))return '../'.repeat(directory||index?2:1);
 return './';
}

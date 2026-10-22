const root=document.querySelector('#scenes');
const scenes=await fetch('scenes.json').then(response=>{if(!response.ok)throw new Error('Scene catalog unavailable');return response.json();});
const first=document.querySelector('#first-world');
if(scenes[0]&&first){first.href=scenes[0].path;first.textContent=`Enter ${scenes[0].title}`;}
for(const scene of scenes){
  const link=document.createElement('a');
  link.className='scene';
  link.href=scene.path;
  const image=document.createElement('img');
  image.src=scene.preview;
  image.alt='';
  const copy=document.createElement('div');
  const title=document.createElement('h3');
  title.textContent=scene.title;
  const summary=document.createElement('p');
  summary.textContent=scene.summary;
  copy.append(title,summary);
  link.append(image,copy);
  root.append(link);
}

// Optional agent skills, listed only here. Core skills in the package's skills/
// folder are installed in every world; an optional skill is installed only in a
// schema v2 world whose scene.destinations names its destination, and removed
// again when the destination is dropped. This module has no imports so the
// browser contract and the host's skill copies can share it.
export const OPTIONAL_SKILLS=Object.freeze({
  'holodeck-export-unity':Object.freeze({destination:'unity'}),
});
export const DESTINATIONS=Object.freeze([...new Set(Object.values(OPTIONAL_SKILLS).map(skill=>skill.destination))]);
export const isOptionalSkill=name=>Object.hasOwn(OPTIONAL_SKILLS,name);
export function enabledOptionalSkills(world){
  const declared=world?.schemaVersion===2&&Array.isArray(world.scene?.destinations)?world.scene.destinations:[];
  return Object.keys(OPTIONAL_SKILLS).filter(name=>declared.includes(OPTIONAL_SKILLS[name].destination));
}

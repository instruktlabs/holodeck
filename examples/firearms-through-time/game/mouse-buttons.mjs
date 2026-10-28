// Mouse buttons from the Pointer Events `buttons` mask (1 primary, 2 secondary). A browser sends pointerdown only for the first
// button pressed and pointerup only for the last one released. A button pressed or released while another is held arrives as
// pointermove ("chorded buttons"), so read every change from the mask. Holding RMB to aim and clicking LMB to fire is such a chord.
export const createMouseButtons=()=>({buttons:0});
export function readMouseButtons(s,buttons){
 const now=buttons|0,pressed=now&~s.buttons,released=s.buttons&~now;s.buttons=now;
 return {triggerDown:!!(pressed&1),triggerUp:!!(released&1),aimDown:!!(pressed&2),aimUp:!!(released&2)};
}

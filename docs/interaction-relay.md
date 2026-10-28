# Opt-in rigid interaction relay

Enable `interaction.relay@1` alongside `interaction.joint@1`. A placement can use
`behavior: {type:'relay', target:'panel-id', action:'toggle'|'reset', requiresOpen?:'selector-id'}`.
Targets and optional prerequisites must be distinct existing rigid-joint objects.
There are no callbacks, recursive routes or arbitrary world writes.

The user must be within normal interaction reach of the relay. The target must
be visible and have a valid joint binding. A start can require an open selector;
stop and reset remain available after deselection. Reset returns that target's
angle and open state to rest. All state is transient; appearance-only updates
retain it and global activity reset clears it.

A joint may opt into `remoteOnly:true` to prevent direct interaction while
remaining addressable by its relay. This does not add moving collision, scoring,
weapon simulation, networking or general scripting. Existing worlds do not
enable this behavior automatically.

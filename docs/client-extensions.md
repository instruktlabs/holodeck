# Optional local client extensions

A development host can explicitly set `HOLODECK_CLIENT_EXTENSION` to an absolute
local JS/JSX/TS/TSX entry. It must default-export a React component. The component
runs inside the world canvas and receives `runtime`, `cameraMode`, `inhabiting`,
`person` and `look`. This is trusted local code, with the same authority as other
client code; it is not an asset sandbox or a public plugin installation protocol.

`look` is a ref. While the walking view is active, `look.current.turn(yaw, pitch)`
turns the walking look by radians (yaw positive to the left, pitch positive up)
inside the mouse-look pitch clamp, and returns the `[yaw, pitch]` it applied;
otherwise it applies nothing and returns `[0, 0]`, and outside walking views
`look.current` may be null. It is for gameplay that moves the aim, such as weapon
recoil the player corrects with the mouse. A turn shows from the next frame.
Cosmetic shake should offset the camera instead and must not use it.

Without that setting the host imports a no-op component. Scene JSON cannot turn
it on. Assets and gameplay owned by an external project stay in that project; the
one exception is [examples/firearms-through-time](../examples/firearms-through-time/README.md),
a complete game kept here as a reference for the hook (R3F extension, shared game
rules and the matching Unreal C++ module). It is not part of the npm package.
The entry directory is explicitly allowed for Vite development file serving;
the usual Vite deny list still applies. Choose a dedicated project directory.

Extensions must verify the scene they support, gate input on possession and pause,
release listeners/resources, and use the host React/Three instances. They must
not change the static world asset validator to sneak in unsupported asset types.
An explicitly loaded skinned viewmodel is a separate runtime capability from the
world's static import/export profile.

This hook is experimental. Static export is not yet extension-aware and should
not be represented as packaging an extension. Do not run a distribution build
with a private extension configured. Versioned lifecycle, error isolation,
manifest validation and portable export remain work before a public plugin API.

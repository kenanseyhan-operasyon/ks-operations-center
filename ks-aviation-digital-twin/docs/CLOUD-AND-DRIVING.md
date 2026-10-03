# Cloud scenes and R14 driving

The existing Render static site and `ks-aviation-digital-twin` branch remain the deployment target.

## Cloud activation

1. Apply `supabase/migrations/20261003_cloud_scenes.sql` to the user's existing Supabase project.
2. Set Render build variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to that project's URL and **publishable / anon** key. Never set a service-role or secret key in client configuration. The build rejects those keys.
3. Redeploy; the prebuild generates `public/cloud-config.json`.
4. Open **Bulut kayıt / hesap**, create or sign into an application account. Use the same account on phone and computer. The Supabase dashboard login is separate from this application account.
5. Verify a scene saved on device A loads on device B. Verify a stale revision cannot overwrite a newer revision. Verify unauthenticated and different-account reads/writes are rejected before treating activation as complete.

Scenes and the last 30 saved revisions belong to `auth.uid()`. Public visitors cannot read private cloud scenes. An authenticated RPC performs a transactional compare-and-swap write; direct table mutation is revoked. These new tables do not modify legacy application tables.

Local scenes are retained before any cloud request. Existing local work is never silently replaced by a different cloud scene. Opening a cloud scene keeps a device backup accessible from the Cloud dialog. Offline failures do not report cloud success. No service worker or offline synchronization is implied.

## Driving and route rehearsal

Select R14, then **Sürüş / Güzergâh**. Start the engine. Hold W/up to accelerate, S/down to brake then reverse, A/D to steer, Space to brake. Q/E select turn signals and H selects hazards. On-screen controls support simultaneous touch steering/throttle. Pointer cancellation, tab hiding and blur release inputs and stop the rehearsal.

In route settings choose an aircraft, set cruise/approach speeds and approach distance, then draw points starting ahead of the vehicle. The first point is its current centre; the last point is its parking centre. Finish, then start. Curves preserve the initial cab direction and reject curvature beyond the steering model. Routes and resulting parking positions are explicit scene data and participate in save/export. Reset is an explicit repositioning to the run's starting pose, not a driving manoeuvre.

The R14 paired tyre meshes are split at runtime into six wheel pivots. Only front pivots steer. Wheel rotation follows signed travel and measured radius. Existing front and rear indicators flash independently; rear position lamps brighten under braking. Night headlamps and platform animations remain supported. Cab heading now matches the plan-view heading.

This is a route rehearsal foundation. It does not yet implement automatic aircraft/obstacle collision checking, verified wing clearances, bonding, hose connections, fuel transfer, or manufacturer-approved operating limits. Speed settings are user-defined rehearsal values. Platform, railing and gate must be closed before driving; moving vehicles cannot operate those animations.

## Verification

`npm test` tests geometry and lamps using the actual R14 GLB, drive/reverse/brake behaviour, equipment interlocks, route arrival and approach speed at different frame rates, data round trips, and cloud-client version conflicts with independent simulated clients. `npm run build` typechecks and produces the Render deployment. Real database authorization and cross-device cloud verification must be performed after activation. Cloud browser WebGL availability determines whether live visual checks can include the 3D model or only the map/UI.

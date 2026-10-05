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

## Account and email flows

**Giriş yap / Sign in** and **Hesap oluştur / Create account** are separate tabs. Registration requires two matching passwords of at least 12 characters. Existing users can still sign in with their existing password; the new-password rule does not reject older login credentials. Every password input has its own accessible show/hide button. Messages follow the current TR/EN language; raw Auth and database diagnostics are never displayed.

- Registration without an immediate session opens **E-posta doğrulaması bekleniyor / Email verification pending**. It includes **Doğrulama e-postasını tekrar gönder / Resend verification email** and a route back to sign-in. Supabase's anti-enumeration responses are respected: an accepted request does not prove an account was created or an email was delivered.
- **Şifremi unuttum / Forgot password** sends the existing Supabase `/recover` request. No password changes until the user opens the email link and submits two matching new passwords. The recovery UI also survives a page refresh.
- Confirmation and recovery use the existing client-only implicit Auth flow. Supabase returns credentials in the URL fragment; startup removes them immediately, opens the account screen, and validates the access token with Auth `/user` before retaining a session. It never trusts URL user IDs or decoded JWT claims. Invalid links produce a safe translated message.
- Signup, resend and recovery all send `redirect_to` for the current site root. In Supabase **Authentication → URL Configuration**, the production **Site URL** and allowed redirect must include `https://ks-aviation-digital-twin.onrender.com/`. Never disable email confirmation to work around email delivery problems.
- Auth email success means the sending request was accepted, not inbox delivery. Check spam, Auth logs, SMTP sender configuration and rate limits. Supabase's default SMTP is restricted; production delivery to arbitrary users may require custom SMTP. The UI also explains unauthorized recipient and rate-limit responses. No SMTP secrets belong in this static site.

The existing `KS_ADT_CLOUD_AUTH_V1` session key, scene storage keys, ownership policies, save RPC and revision conflict checks are retained. No migration or user deletion is involved. The automated Auth transport tests use isolated fake accounts and storage; they do not prove real email delivery or physical PC/phone testing. Finish live acceptance with a user-controlled mailbox and password, then save on PC and open the same account's cloud scene on the phone.

## Driving and route rehearsal

Select R14, then **Sürüş / Güzergâh**. Start the engine. Hold W/up to accelerate, S/down to brake then reverse, A/D to steer, Space to brake. Q/E select turn signals and H selects hazards. On-screen controls support simultaneous touch steering/throttle. Pointer cancellation, tab hiding and blur release inputs and stop the rehearsal.

In route settings choose an aircraft, set cruise/approach speeds and approach distance, then draw points starting ahead of the vehicle. The first point is its current centre; the last point is its parking centre. Finish, then start. Curves preserve the initial cab direction and reject curvature beyond the steering model. Routes and resulting parking positions are explicit scene data and participate in save/export. Reset is an explicit repositioning to the run's starting pose, not a driving manoeuvre.

The R14 paired tyre meshes are split at runtime into six wheel pivots. Only front pivots steer. Wheel rotation follows signed travel and measured radius. Existing front and rear indicators flash independently; rear position lamps brighten under braking. Night headlamps and platform animations remain supported. Cab heading now matches the plan-view heading.

## Continue a saved route on another device

Choose **Sürüşü kaydet / Save drive** while driving or paused. This stops the vehicle and uses the existing explicit local/cloud save flow. Wait for **İnternete kaydedildi / Saved online** before changing devices; a local-only or pending message does not mean the other device has received the scene.

On the other device sign in to the same application account, use **Buluttaki sahneyi aç / Open cloud scene** if local work prevents automatic loading, select R14 and open **Sürüş / Güzergâh**. The vehicle opens paused at the saved position, heading and route distance. Start the engine, then choose **Devam / Resume**. It accelerates from rest and follows the remaining original path, including the approach zone. A completed route stays parked.

The optional `driving` scene field saves each vehicle's original start pose, current pose, progress, signed wheel travel, wheelbase, scale and a route fingerprint. The existing `VehicleMotion` engine rebuilds and verifies the original path; there is no replacement driving algorithm. The saved wheelbase is retained even while the new device is still loading the model. Moving/scaling the vehicle or changing its route invalidates the old checkpoint without preventing the scene from opening. Manual driving and resetting clear automatic resume state. Legacy scenes remain readable. JSON exports also include paused drive progress.

Save remains explicit. Pausing, closing the panel or hiding the tab captures the current progress in the working scene; press Save for persistence. This is not background auto-sync, and movement does not continue on an inactive device.

This is a route rehearsal foundation. It does not yet implement automatic aircraft/obstacle collision checking, verified wing clearances, bonding, hose connections, fuel transfer, or manufacturer-approved operating limits. Speed settings are user-defined rehearsal values. Platform, railing and gate must be closed before driving; moving vehicles cannot operate those animations.

## Verification

`npm test` tests geometry and lamps using the actual R14 GLB, drive/reverse/brake behaviour, equipment interlocks, route arrival and approach speed at different frame rates, data round trips, and cloud-client version conflicts with independent simulated clients. Checkpoint regression tests cover saving on a curve, repeated PC/phone transfers with isolated storage, reloading, paused/complete states, invalid checkpoints and model-loading order. `npm run build` typechecks and produces the Render deployment. Real database authorization and cross-device cloud verification must be performed after activation. Cloud browser WebGL availability determines whether live visual checks can include the 3D model or only the map/UI. Simulated device/client tests and transaction-only database tests are not a physical phone/browser login test.

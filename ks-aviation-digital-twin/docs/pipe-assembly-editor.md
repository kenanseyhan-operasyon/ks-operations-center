# Connected pipe assembly editing

The pipe editor has three distinct scopes: single section, multiple sections,
and connected assembly. Assembly editing applies to a source connection route.

Select a valve inlet, choose **Bağlı takım**, then use **Giriş − / +** (centimetres
along the current straight collector span) or click **Kollektörde yeni giriş yerini
seç** and a point on the same collector. The root valve is always included. The
checkbox list explicitly controls additional downstream equipment. The collector
and unselected equipment remain fixed. Intermediate outgoing route points follow
the moving side; the final segment reconnects to any unselected endpoint.

Every change is staged: the orange equipment ghost and route centre lines show
the proposal. **Uygula** commits it as one history entry; **Vazgeç** changes nothing.
A changed scene invalidates the preview. Source IDs remain unchanged, explicit
taps persist, and edited routes retain `routeEdited`. This is a translation tool,
not automatic collision avoidance or rotation around collector bends. Arrow steps
are rejected past the current straight span. A clicked point can select a different
span of the same collector, still without rotating the equipment.

The desktop object panel closes on pipe selection. The connected assembly panel is
330 px wide and collapses advanced point controls. **Bağlı hattı ekrana sığdır**
frames the affected routes.

Regression coverage: `tests/pipe-assembly.test.ts`, included in `npm run test:fire`.
Uses the real ADB loading branch and verifies fixed collector/unrelated geometry,
translation of all outgoing waypoints, fixed remote ports, explicit inclusion of
remote equipment, read-only preview/cancel, stale-plan rejection, history,
serialization/reload/migration, actual panel buttons and edit permission guard.

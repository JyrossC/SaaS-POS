# Frontend Conventions

This file documents how the React app should be organized and how it should interact with the API, permissions, and store scope.

## Frontend stack

- React + TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Centralized design system and shared UI library

## Feature layout

```text
src/features/
├── auth/
├── dashboard/
├── products/
├── inventory/
├── sales/
├── pharmacy/
├── reporting/
├── admin/
└── settings/
```

Each feature area should have:

- route entry point
- query hooks / API client functions
- mutation hooks
- form state as needed
- permission-aware component rendering
- empty-state support

## Data access principles

- Query keys must include tenant and store context.
- Cache invalidation must be narrow and intentional.
- Response data must not be treated as authoritative for business aggregates without server-side calculations.
- Do not optimize by sharing data across distinct tenant/store contexts.

## Example query keys

```ts
['tenant', tenantId, 'stores', storeId, 'products']
['tenant', tenantId, 'report', 'sales-summary', { period, storeId }]
['tenant', tenantId, 'inventory', 'alerts', { storeId }]
```

## Permission-aware UI

Permission checks in the UI are a convenience, not a control.

The UI should:

- hide or disable actions the user cannot perform
- show accountable error states when a forbidden action is attempted
- respect scope-specific access to stores and reports

The backend remains responsible for enforcement.

## Design and UX conventions

- Keep premium styling with a restrained corporate aesthetic.
- Use burgundy as the primary brand color and crimson for destructive actions.
- Centralize colors, spacing, radius, shadows, and typography into CSS variables.
- Make POS screens fast and keyboard-friendly.
- Keep admin dashboards and operational screens distinct.

## Empty-state requirements

Every page must support an empty database without fabricated data. Examples:

- no products created
- no sales yet
- no stores configured
- no suppliers or purchase orders
- no available reports for a chosen period

Each state should explain the issue and offer a next action.

## Integration rules

- API calls should use a centralized client.
- Form validation should supplement server-side validation, not replace it.
- Transactional operations should show clear success/error messages.
- Sensitive actions should require deliberate confirmation.

## Testing expectations

Focus on:

- permission-sensitive rendering
- query invalidation after mutation
- empty-state rendering
- form validation and error recovery
- route authorization gates

Do not rely on UI-only validation to guarantee compliance with the backend rules.

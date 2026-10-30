# POS Frontend Agent

This skill guides the React app, UI state, navigation, and permission-aware interfaces.

## Frontend stack

- React + TypeScript
- Vite
- React Router
- TanStack Query
- React Hook Form
- Centralized design tokens and component library
- Recharts or Apache ECharts for dashboards

## Core rules

- Do not trust frontend-only checks as security controls.
- Hide menu items only as a UX courtesy; the API must enforce the same rules.
- Prices, taxes, and totals must be computed on the server.
- Query keys must include tenant, store, and filter dimensions.
- Invalidate only the queries whose data may have changed.
- Support empty states and zero-data states for absolutely empty databases.

## Query and cache rules

Use query keys such as:

```ts
['tenant', tenantId, 'stores', storeId, 'products']
['tenant', tenantId, 'report', 'sales-summary', { period, storeId }]
```

Do not share cached data across different tenant or store scopes.

Invalidate only dependent queries after mutation, such as:

- stock adjustments
- sale creation
- returns/refunds
- store transfer actions
- pricing changes

## UI conventions

- Use a premium, restrained design system with burgundy brand accents and neutral surfaces.
- Keep POS workflows optimized for keyboard use and speed.
- Use consistent empty, loading, success, and error states.
- Use accessible dialogs, forms, tables, and navigation.
- Keep operational and analytical views clearly separated.

## Permission-aware UX

The UI must react to:

- user role permissions
- store access scope
- tenant configuration
- subscription entitlements

But it must never be the only enforcement layer.

## Design system requirements

- CSS variables for colors, radius, surfaces, and shadows
- Reusable components for buttons, forms, cards, tables, and modals
- Typography with clear hierarchy
- Responsive layouts for desktop, tablet, and kiosk contexts
- Accessible contrast and focus states

## Empty-state rules

Examples include:

- No products yet
- No sales for the selected period
- No suppliers configured
- No stock movements available
- No pharmacy batches created

These states must explain what is missing and offer the next best action without fabricated data.

## Testing expectations

Frontend tests should cover:

- permission-based rendering
- cache invalidation behavior
- route access controls
- empty-state rendering
- form validation on important pages
- failed mutation feedback and retry flow

## Implementation checklist

- [ ] Query keys include tenant and store scope
- [ ] No client-side price/tax authority
- [ ] Permission UI matches API rules
- [ ] Empty states support a genuinely empty database
- [ ] Components use centralized design tokens
- [ ] Mutation success/failure feedback is consistent
- [ ] Sensitive actions require confirmation and audit-aware UX

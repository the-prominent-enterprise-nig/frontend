## 📋 Description

<!-- Please include a concise summary of the changes and the issue this PR addresses. -->

## 🔗 References

<!-- Link to the relevant ticket. -->

- **Ticket:** [Link to ticket]()
<!-- Link to any design specification or related documentation. -->
- **Design/Spec:** [Link if applicable]()

## 📦 Type of Change

<!-- Please check the options that are relevant. -->

- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] 🚀 New feature (non-breaking change which adds functionality)
- [ ] ⚠️ Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] ♻️ Refactoring
- [ ] 🎨 UI/Design update

## 📝 Module(s) Affected

<!-- Check which modules this PR affects -->

- [ ] Human Resources (HR)
- [ ] Accounting
- [ ] Inventory
- [ ] POS
- [ ] CRM
- [ ] Procurement
- [ ] Sales
- [ ] Settings
- [ ] Workspace
- [ ] Dashboard
- [ ] Core/Shared

## 🔐 Security & Data Considerations

- [ ] No sensitive data (salaries, deductions, tax info, tokens) is logged
- [ ] Routes/actions are guarded with appropriate permission checks (`can` / `canAny` / `canAll`)
- [ ] Input validated with Zod schemas
- [ ] No direct `fetch()` calls bypassing the `api` client
- [ ] Auth guards are applied at the layout level, not the page level

## ✅ Quality Assurance Checklist

- [ ] I have performed a self-review of my own code
- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] Zod schemas are properly defined for all form/mutation inputs
- [ ] Forms use React Hook Form + `Controller` for every field (no `register()`)
- [ ] Business logic lives in Server Actions/hooks, not components
- [ ] Error handling surfaces meaningful, user-facing messages
- [ ] No unused imports or dead code

## 🧪 Testing Verification

- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm type-check` passes
- [ ] `pnpm build` succeeds locally
- [ ] `pnpm test` passes (if applicable)
- [ ] Manual testing completed (describe test scenarios below)

## 🧪 Manual Testing Scenarios

<!-- Describe what you tested manually -->

- [ ] Happy path tested
- [ ] Error / edge cases tested
- [ ] Auth & permission restrictions verified
- [ ] Mobile responsiveness verified (if UI changes)
- [ ] Accessibility (WCAG AA) verified (if UI changes)

**Testing notes:**

<!-- Add any relevant testing details here -->

## 🚀 Deployment Notes

<!-- Any special deployment considerations -->

- Environment variables needed: [ ] Yes [ ] No
- Feature flags needed: [ ] Yes [ ] No
- Requires coordination with backend: [ ] Yes [ ] No

## 🔄 Reviewers Checklist

**For reviewers only:**

- [ ] Changes align with project architecture
- [ ] No business logic in components/pages (lives in hooks/server actions)
- [ ] Error handling is comprehensive
- [ ] Sensitive data is properly protected
- [ ] Shared component/prop changes are backward compatible for existing usages
- [ ] New routes/components follow existing conventions

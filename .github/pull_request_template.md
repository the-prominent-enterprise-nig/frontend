## 📋 Description

<!-- Please include a concise summary of the changes and the issue this PR addresses. -->

## 🔗 References

<!-- Link to the Jira ticket. Example: [JIRA-123](https://your-domain.atlassian.net/browse/JIRA-123) -->

- **Jira Ticket:** [Link to ticket]()
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
- [ ] Dashboard
- [ ] Core/Shared

## 🔐 Security & Data Considerations

<!-- If applicable, describe security impacts or data protection measures -->

- [ ] No sensitive data (salaries, deductions, tax info) is logged
- [ ] Authentication/authorization checks are in place (if applicable)
- [ ] Database queries properly parameterized
- [ ] User input validated with Zod schemas

## 📸 Screenshots / Visuals

<!-- If this PR includes UI changes, attach screenshots, recordings, or GIFs to facilitate review. -->

## ✅ Quality Assurance Checklist

- [ ] TypeScript strict mode compliance (no `any` types)
- [ ] I have performed a self-review of my own code
- [ ] Code follows project naming conventions (see `.skills/clean-code/SKILL.md`)
- [ ] All functions are under 20 lines with single responsibility
- [ ] Error handling includes meaningful context
- [ ] I have updated relevant comments and documentation
- [ ] I have verified forms use React Hook Form + Zod pattern (if applicable)
- [ ] I have verified component reuse (no duplicate components created)
- [ ] All database migrations are included (if schema changes)
- [ ] Server actions validate input with Zod (for mutations)
- [ ] Routes follow `(app)/(admin/user)/module/` structure

## 🧪 Testing Verification

- [ ] `pnpm lint` passes with no warnings
- [ ] `pnpm type-check` passes
- [ ] `pnpm build` succeeds locally
- [ ] `pnpm test` passes (if applicable)
- [ ] Manual testing completed (describe test scenarios below)

## 🧪 Manual Testing Scenarios

<!-- Describe what you tested manually -->

- [ ] Happy path tested
- [ ] Error cases tested
- [ ] Edge cases considered
- [ ] Mobile responsiveness verified (if UI changes)
- [ ] Accessibility (WCAG AA) verified (if UI changes)

**Testing notes:**

<!-- Add any relevant testing details here -->

## 🚀 Deployment Notes

<!-- Any special deployment considerations or database migrations needed? -->

- Database migrations: [ ] Yes [ ] No
- Environment variables needed: [ ] Yes [ ] No
- Feature flags needed: [ ] Yes [ ] No

## 📚 Related Documentation

<!-- Link to any relevant documentation or skills -->

- [Route Architecture](../.skills/route-architecture/SKILL.md)
- [React Forms](../.skills/react-forms/SKILL.md)
- [Component Reuse](../.skills/component-reuse/SKILL.md)
- [API Integration](../.skills/api-integration/SKILL.md)
- [Clean Code](../.skills/clean-code/SKILL.md)

## 🔄 Reviewers Checklist

**For reviewers only:**

- [ ] Changes align with project architecture
- [ ] No duplicate components or code
- [ ] Error handling is comprehensive
- [ ] Sensitive data is properly protected
- [ ] Database schema changes are backward compatible
- [ ] Tests are adequate coverage for changes

# Achieved outcome and confidence interval

Issue: [#82](https://github.com/suissa/OaaS.Quest/issues/82)

This behavior calculates the sample mean of outcome observations, sample standard deviation, a two-sided confidence interval, and progress relative to declared baseline and target. Inputs are immutable; no persistence, settlement or external side effects occur. Scope is tenant/outcome/execution-bound. A one-observation sample returns a zero-width interval and standard deviation zero (uncertainty cannot be estimated from one sample).
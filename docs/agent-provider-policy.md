# Provider adapters and subscription boundaries

Research checked 2026-10-21. This is an engineering decision record, not a provider
endorsement or a finding that every possible deployment is permitted. A provider's
current agreement, account plan and organization policy still govern its use.
Only the local Codex adapter is implemented. No proxy was installed or adopted.

## Decision

Holodeck should connect to an agent session through an officially documented
integration surface. A user chooses the provider, model and billing route. The
agent retains its documented authentication and tool-execution boundaries;
Holodeck presents supported permission requests and supplies the world workspace,
references, proposals and observations. SDK/API routes can have different approval
semantics and need their own evaluation.

A subscription is not a general-purpose inference entitlement. Support must be
evaluated per product and transport, not merely per company or model name.
An API-key route is a separate, explicitly selected connection with disclosed
billing. Some providers document subscription API keys; others require metered API
usage. Do not infer either arrangement from the presence of a key.

## CLIProxyAPI as a research reference

The [repository](https://github.com/router-for-me/CLIProxyAPI) describes compatible
HTTP APIs over multiple upstream products, OAuth-backed connections, streaming,
tool translation and multi-account routing. Its MIT software license does not
grant rights to any upstream service or subscription.

Its [SDK architecture](https://github.com/router-for-me/CLIProxyAPI/blob/main/docs/sdk-advanced.md)
separates provider executors, request/response translation and model discovery.
Its [embedding guide](https://github.com/router-for-me/CLIProxyAPI/blob/main/docs/sdk-usage.md)
also makes lifecycle and cancellation explicit. These are useful design questions
for Holodeck. We are not copying its implementation, credential handling,
subscription-token proxying or multi-account rotation.

## Provider findings

| Product | Candidate Holodeck route | Subscription assessment / condition |
| --- | --- | --- |
| OpenAI Codex | Installed `codex app-server`, managed ChatGPT login | Documented client integration; current implementation uses this route. |
| Anthropic Claude Code | Unmodified installed CLI, native end-user authentication | Current help explicitly supports subscription usage for `-p`/Agent SDK; product offering, login ownership and commercial host conditions still apply. |
| Google Gemini CLI | Installed CLI via ACP | Documented developer-tool interface; no third-party direct backing-service access using CLI OAuth. |
| GitHub Copilot | Official SDK with the user's CLI login | Explicit desktop-app scenario in official authentication guidance. |
| Kimi Code | Installed CLI via ACP, or documented subscription API key | Personal interactive coding; no resale, identity spoofing or unattended batch/pipeline service. |
| Google Antigravity | Separately contracted enterprise/API route | Consumer-plan wrapping inside third-party apps explicitly unsupported. Exclude consumer subscription adapters. |
| xAI Grok Build | Evaluate official ACP/headless or separately billed API | Technical surfaces documented; this review does not establish consumer subscription permission for Holodeck embedding. Hold subscription adapter. |
| Meta Muse Code | Evaluate official CLI/SDK; API separately | Subscription credentials limited to Muse Code. Third-party embedding entitlement unresolved here; hold subscription adapter. |
| Cognition Devin | Official API, scoped PAT/service-user key | Documented programmatic route. Plan/credits and remote execution must be explicit; no generic model proxy entitlement inferred. |
| Kiro | Installed CLI via documented ACP | Official custom-client interface; subscription supports ACP and development automation, but routing outside native interfaces is prohibited. |
| Cursor | Installed CLI via ACP; official SDK separately | Both documented. Preserve native ACP login/permissions; SDK keys, billing and headless approval behavior differ. |
| Qwen Code / QwenCloud | Native agent with explicitly selected current API/Token Plan credentials | Current quickstart says Qwen OAuth ended 2026-04-15. Token Plan supports compatible tools; selected service/region terms still need review. |
| iFlow CLI | No active candidate | Official repository announces CLI shutdown on 2026-04-17 (UTC+8); historical SDK/ACP pages do not establish current availability. |

### OpenAI Codex

The official [App Server documentation](https://learn.chatgpt.com/docs/app-server)
describes building clients around Codex, with sessions, streaming events, tools,
approvals, managed ChatGPT authentication and model discovery. This supports our
chosen native-session architecture; it does not establish permission for an
independent proxy over private ChatGPT endpoints. The applicable
[Terms of Use outside Europe](https://openai.com/policies/row-terms-of-use/) include
account-sharing and safeguard/limit restrictions. Business/API agreements are
separate. Holodeck currently queries the user's actual account/model availability,
keeps the official process in the selected workspace and never silently changes
to API billing.

### Anthropic Claude Code

The [October 7, 2026 help update](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan)
explicitly says users can still use subscription limits for the Agent SDK,
`claude -p` and third-party apps. The previously announced June change was paused.
Therefore a blanket claim that subscription-backed SDK use is prohibited is
incorrect. Eligible plans' API credits are a separate billing route, not a requirement
to replace subscription login.

The [legal/compliance guidance](https://code.claude.com/docs/en/legal-and-compliance#can-customers-offer-claude-code-in-their-products)
allows products to run unmodified Claude Code under Commercial Terms, preserving
all native authentication methods and direct end-user billing. It forbids reselling
or intermediating usage and collecting, storing or intermediating Claude account
credentials. Native sign-in to the unmodified binary is expressly preserved,
including on a hosting platform. Its separate developer-authentication restrictions
still apply; subscription billing support does not authorize a custom Claude.ai
login or a token proxy.

The [SDK overview](https://code.claude.com/docs/en/agent-sdk/overview#get-started)
still restricts third-party developers offering Claude.ai login or rate limits
without prior approval and recommends API/provider authentication. These rules
must be read alongside the newer end-user subscription guidance. The
[programmatic CLI documentation](https://code.claude.com/docs/en/headless) itself
classifies `claude -p` as using the Agent SDK via CLI: merely replacing an SDK
package with a subprocess is not a separate policy exemption.

**Proposed adapter, not implemented:** Holodeck could launch the user's installed,
unmodified CLI in the selected world workspace; consume documented JSON/stream
events; expose local world tools through MCP; and preserve native authentication,
session, permission and interruption behavior. This is our conditional engineering
interpretation of the documented route, not Holodeck-specific legal clearance.
It must not collect tokens, provide a separate Claude.ai login, pool usage, or
silently change billing. No inference or authentication test was performed here.

Read-only inspection identified installed CLI 2.1.300 and examined `--help`.
Implementation note: `--bare` deliberately skips subscription OAuth credentials
and requires an API/provider route. Do not use it for the user's own-subscription
profile. Evaluate workspace discovery, MCP configuration and permission handling
through the documented non-bare controls instead; validate their actual behavior
before enabling an adapter.

The [Consumer Terms](https://www.anthropic.com/legal/consumer-terms) prohibit
automated access except via API keys or explicit permission. Our local public
fetch returned the PBC/US version; the web reader returned the EEA/Switzerland
version at the same URL. Do not import the latter's regional consumer definition
into a US assessment. Both displayed October 8, 2025. The separate
[Commercial Terms](https://www.anthropic.com/legal/commercial-terms) cover the
product-host offering and applicable API services. No new terms were accepted.
Before distribution, confirm the exact offering satisfies those conditions;
the reviewed sources do not specifically classify Holodeck's custom browser UI.

### Gemini CLI and Antigravity are different products

Gemini CLI documents [ACP integration](https://geminicli.com/docs/cli/acp-mode/)
for IDEs and other developer tools. Its [terms/privacy page](https://geminicli.com/docs/resources/tos-privacy/)
separately prohibits third-party software directly accessing its backing services
with CLI OAuth credentials. Our inference is to use the documented ACP subprocess
and leave authentication and upstream requests inside Gemini CLI; recreating its
backend client is outside this design. Applicable terms vary by account route.

Antigravity's [FAQ](https://www.antigravity.google/docs/faq/) explicitly distinguishes
direct headless scripting/CI from wrapping the CLI inside third-party coding
agents/apps: the latter is unsupported on consumer plans. Its
[terms, section 6](https://www.antigravity.google/terms) also restrict third-party
service access. Those consumer terms exclude specified enterprise, Cloud,
Workspace and API-key arrangements governed by other agreements. Do not assume
Gemini CLI's integration guidance covers Antigravity, or that those exclusions
automatically permit a particular wrapper. Any enterprise/API integration needs
its own contract evaluation.

### GitHub Copilot

The official [SDK authentication guide](https://docs.github.com/en/copilot/how-tos/copilot-sdk/auth/authenticate)
explicitly includes desktop apps using the user's existing CLI login and separately
documents authorized-user OAuth-app scenarios for multi-user applications. These
are supported authentication flows, not permission to read or repurpose arbitrary
credential files. The [CLI license](https://github.com/github/copilot-cli/blob/main/LICENSE.md)
has separate unmodified-redistribution conditions and grants no service access
by itself. Start with a user-installed CLI; retain applicable
[Copilot service terms](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features#github-copilot)
and organization policies. Documenting an integration is not a promise of unlimited
model usage or access to every capability.

### Kimi Code

Official [ACP guidance](https://www.kimi.com/code/docs/en/kimi-code-cli/guides/ides)
reuses the CLI's existing authentication. The [product documentation](https://www.kimi.com/code/docs/en/)
also supports subscription API keys for third-party coding tools. Its
[Community Guidelines](https://www.kimi.com/en/help/kimi-code/community-guidelines)
limit subscriptions to personal interactive use, prohibit resale and client
identity spoofing, and exclude non-interactive batch/data pipelines, including
local scripted automation. Its [paid-services agreement](https://www.kimi.com/user/agreement/paidServiceAgreement?version=v2)
incorporates product rules. Our inference is that an interactive user-owned
Holodeck coding session fits the documented integration direction; that is not
Holodeck-specific approval. An unattended job service needs a separate
commercial/API evaluation. Do not market the candidate as unrestricted automation.

### Grok Build

Official [headless documentation](https://docs.x.ai/build/cli/headless-scripting)
describes structured output and ACP, but [settings guidance](https://docs.x.ai/build/settings)
places headless modes under Enterprise. The
[consumer subscription terms](https://x.ai/legal/x-subscription-terms-of-service)
and [Enterprise terms](https://x.ai/legal/terms-of-service-enterprise) are distinct.
The presence of an OAuth implementation in a proxy does not resolve which
entitlement covers Holodeck. Keep subscription support unqualified until the
provider confirms the proposed integration or documentation clearly covers it.

### Muse Code

The [subscription page](https://dev.meta.ai/docs/muse-code/subscriptions) limits
flat-rate usage to Muse Code CLI; additional API keys use pay-as-you-go billing.
[Authentication guidance](https://dev.meta.ai/docs/muse-code/auth) directs scripts
and CI to API keys. [Model API Terms, section 3.2](https://dev.meta.ai/legal/terms-of-service)
make coding-harness subscriptions and their connected credentials distinct.
Although automation surfaces exist, this review did not establish that a
third-party browser wrapper may consume the subscription. Hold that route and
evaluate official SDK/API access separately. Do not extract the connected key.

### Devin

The [official API authentication model](https://docs.devin.ai/api-reference/authentication)
supports scoped personal tokens for a human's programmatic access and service-user
keys for automation. That supports an official session integration, not a claim
that Devin account credentials may back a generic model endpoint. The
[Platform Terms](https://cognition.com/legal/platform-terms-of-service), plan and
usage limits apply. A remote execution provider must be visibly distinguished
from Holodeck's local mounted workspace before any files are sent.

### Additional providers and retired routes

CLIProxyAPI's main README is not an exhaustive provider or entitlement registry.
The following checks broaden the study without adopting a proxy or promising
support for every product mentioned by its ecosystem.

Kiro's [ACP documentation](https://kiro.dev/docs/acp/) explicitly covers applications
and purpose-built clients, with capability negotiation and client-owned permission
interfaces. Its [FAQ](https://kiro.dev/faq/) permits subscriptions in ACP-compatible
IDEs and software-development automation, while prohibiting third-party harnesses
that route outside native Kiro interfaces. Its [license](https://kiro.dev/license/)
points to the applicable AWS agreement. This supports evaluating a native ACP
client; it does not authorize reproducing Kiro's private service protocol.

Cursor documents [custom ACP clients](https://cursor.com/docs/cli/acp) using
`agent acp`, native authentication, sessions, cancellation and permission requests.
Its separate [SDK](https://cursor.com/docs/sdk/typescript) supports local/cloud
agents, API keys or SDK-managed browser login, and charges the relevant user/team
plan using the documented request pools. SDK login does not discover desktop-app
credentials. Headless SDK runs have no interactive approval flow and local
sandboxing is off by default; that route needs explicit execution-policy work.
The [service terms](https://cursor.com/terms-of-service) still apply, including
restrictions on selling or renting service access. Native ACP is the closer
candidate for Holodeck's interactive session model.

Qwen Code's [current quickstart](https://qwenlm.github.io/qwen-code-docs/en/users/quickstart/)
says Qwen OAuth was discontinued on April 15, 2026 and describes current API-key
and Token Plan routes. [QwenCloud Token Plan](https://docs.qwencloud.com/token-plan/overview)
explicitly supports compatible third-party tools through its dedicated API
endpoint. The [terms overview](https://qwenlm.github.io/qwen-code-docs/en/users/support/tos-privacy/)
still retains historical OAuth text and says terms depend on the selected
provider. Do not revive the old OAuth route based on a proxy implementation.
The exact QwenCloud/Alibaba plan and regional service agreement remain an open
check before enabling an adapter; these products are not interchangeable.

The official [iFlow CLI repository](https://github.com/iflow-ai/iflow-cli) announces
shutdown on April 17, 2026 (UTC+8). Treat the CLI integration as retired for this
study. We did not probe an endpoint or determine the status of unrelated iFlow
products; surviving historical documentation is not availability evidence.

### Source dates and revision limits

All linked sources were reviewed on 2026-10-21. Repository links were read on
their live default branch; no immutable commit SHA was captured. Most product
documentation is unversioned, so the review date is not an effective-date claim.
Dates explicitly displayed by the reviewed sources include:

| Source | Displayed revision/date |
| --- | --- |
| [GitHub Additional Products and Features](https://docs.github.com/en/site-policy/github-terms/github-terms-for-additional-products-and-features) | Effective 2026-08-27 |
| [GitHub Terms of Service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service) | Effective 2026-04-27 |
| [Kimi paid-services agreement v2](https://www.kimi.com/user/agreement/paidServiceAgreement?version=v2) | Updated 2026-08-24; effective 2026-08-31 |
| [Cursor Terms of Service](https://cursor.com/terms-of-service) | Last updated 2026-09-03 |
| [Kiro ACP integration guidance](https://kiro.dev/docs/acp/) | Page updated 2026-10-01 |

## Adapter shape to build after the Codex trial

Normalize session events, not provider authentication or every model API:

```text
Holodeck conversation / selections / world bible
  -> local agent-session adapter
       -> official CLI, SDK or explicitly selected API
       -> workspace tools: read, sample, propose, observe, check
  <- text, progress, approval, proposed change, image, completion
```

An adapter declares provider/product, installed version, transport, authentication
owner, billing mode, supported models and capabilities, local/remote execution,
approval/cancellation semantics, applicable policy links and review date.
Capabilities such as image generation, filesystem tools, MCP, vision and resumption
are independently negotiated; a chat-capable model does not imply all of them.

Select one authoring session explicitly. A provider switch creates a deliberate
handoff of accepted bible, selected references, scene revision and pending work;
it does not silently migrate credentials, tool permissions or private transcripts.
Account exhaustion pauses with a useful message. No silent cross-provider paid
fallback, account rotation or combined subscription pool.

Workspace edits remain scoped, world proposals remain revision-checked, and
coherence observations stay advisory. Voice can produce the same text turn;
speech transcription/generation has its own disclosed local or provider route.
Neither a browser UI nor local hosting removes provider conditions.

Before enabling an adapter, verify a real native login/session, approvals, stop,
resume, tool calls, model listing, failure behavior, workspace scope and applicable
terms. Recheck policy when its product or authentication transport changes and
before public distribution. Unresolved permission remains visibly unsupported.

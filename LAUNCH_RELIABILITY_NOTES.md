# Launch Reliability Notes

## Anthropic model compatibility

Anthropic retired the configured `claude-sonnet-4-20250514` snapshot. Amplify normalizes that legacy value to `claude-sonnet-5` at invocation time and migrated affected persisted skill rows on 2026-08-20. This preserves existing provider keys while preventing a model-not-found failure in `/launch`.

The current model-ID convention is documented by Anthropic at <https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions>. The configuration UI exposes `claude-sonnet-5`, `claude-sonnet-4-6`, and `claude-haiku-4-5` as current suggestions.

## Bid-document extraction

Gemini rejects DOCX attachments at its native file endpoint. The launch pipeline therefore converts DOCX files to text with Mammoth before both classification and XML shredding. PDFs continue to use Gemini file input when available. A user-confirmed **Main RFP** label is preserved as a full-extraction document even when an automated skim is inconclusive.

The Launchpad now warns reviewers when the parsed result lacks a project title, agency, submission deadline, or estimated value; source data should be checked and completed before Go/No-Go.

# elasticsearch/

Vendored from `/Users/greer/dev/glasshouse-web/elasticsearch/` for PGSync (the
`pgsync` service reads `schema.json` via `SCHEMA_URL`; `views.sql` documents
the search views the schema's `nodes` sections read from).

## schema.json diff from upstream

Upstream's `schema.json` maps two fields (`subjects.name` and
`subjects.description`) with a `semantic` sub-field of type `semantic_text`,
pointed at an inference endpoint:

```json
"semantic": {
  "type": "semantic_text",
  "inference_id": "opencouncil-multilingual-e5-small-elasticsearch"
}
```

That endpoint (`opencouncil-multilingual-e5-small-elasticsearch`) only exists
on OpenCouncil's Elastic Cloud deployment — it's an Elastic Cloud inference
endpoint tied to their account, not something a self-hosted
`docker.elastic.co/elasticsearch/elasticsearch` container has. Using
`semantic_text` unmodified would make `es` reject every document PGSync
tries to index.

Both `semantic` sub-fields were changed to plain `text` mappings instead:

| Field | Old mapping | New mapping |
|---|---|---|
| `name.fields.semantic` | `{"type": "semantic_text", "inference_id": "opencouncil-multilingual-e5-small-elasticsearch"}` | `{"type": "text"}` |
| `description.fields.semantic` | `{"type": "semantic_text", "inference_id": "opencouncil-multilingual-e5-small-elasticsearch"}` | `{"type": "text"}` |

Everything else — the PGSync `nodes`/`children`/relationship structure, every
other field mapping, `views.sql` — is byte-identical to upstream. Semantic
(vector) search on subject name/description is unavailable on this stack
until/unless an ELSER or custom inference endpoint is deployed self-hosted;
lexical search on both fields (via their parent `text` mapping with the
`greek` analyzer) is unaffected.

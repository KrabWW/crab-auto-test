## ADDED Requirements

### Requirement: Users can manage project knowledge bases

The system SHALL allow project members to create, update, delete, and browse project-scoped knowledge bases and documents.

#### Scenario: User creates a project knowledge base

- **WHEN** a project member creates a knowledge base in a project
- **THEN** the system MUST persist the knowledge base under that project and MUST NOT expose it to unrelated projects.

### Requirement: Documents are ingested and chunked

The system SHALL ingest supported document types, extract text, split content into chunks, and retain source metadata for retrieval.

#### Scenario: User uploads a requirements document

- **WHEN** a user uploads a supported document
- **THEN** the system MUST extract text, create retrievable chunks, and store source filename, section, page or location metadata when available.

#### Scenario: User reviews document chunk details

- **WHEN** a project member opens an ingested document
- **THEN** the system MUST show its chunk count, chunk order, token count, text preview, and source metadata, and MUST NOT expose documents or chunks from another project.

### Requirement: Knowledge is embedded and retrievable

The system SHALL generate embeddings for document chunks and support semantic retrieval through a replaceable retrieval backend.

#### Scenario: AI workflow requests context

- **WHEN** a LangGraph workflow searches project knowledge
- **THEN** the system MUST return relevant chunks with source references from the authorized project scope.

### Requirement: RAG context is used with source attribution

The system SHALL inject retrieved knowledge into AI generation workflows with traceable source references.

#### Scenario: AI generates test cases from knowledge

- **WHEN** AI-generated test cases use retrieved knowledge
- **THEN** the generation trace MUST include which knowledge sources were used for the draft.

### Requirement: Retrieval quality can be reviewed

The system SHALL expose retrieval diagnostics for query, matched chunks, scores, and selected sources.

#### Scenario: User reviews RAG evidence

- **WHEN** a user opens the AI generation trace
- **THEN** the system MUST show retrieved sources and enough metadata to judge whether the generation used appropriate context.

#### Scenario: User runs retrieval diagnostics from Knowledge

- **WHEN** a project member runs a retrieval diagnostic query
- **THEN** the system MUST show backend/model, matched chunk scores, selected sources, text previews, filenames, sections, pages, and document references in a structured UI rather than raw JSON.

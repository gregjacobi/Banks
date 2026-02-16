const { z } = require('zod');
const groundingService = require('../../services/groundingService');

function register(server) {
  // search-documents: RAG search across grounding documents
  server.tool(
    'search-documents',
    'Search across uploaded research documents using semantic (vector) search. Returns relevant document chunks with source attribution. Useful for finding specific information from analyst reports, earnings transcripts, and other research PDFs.',
    {
      query: z.string().describe('Natural language search query'),
      idrssd: z.string().optional().describe('Optional bank ID to filter results to a specific bank'),
      limit: z.number().optional().describe('Max chunks to return (default 5)'),
    },
    async ({ query, idrssd, limit = 5 }) => {
      try {
        const filters = {};
        if (idrssd) filters.idrssd = idrssd;

        const chunks = await groundingService.retrieveChunks(query, filters, limit);

        if (!chunks || chunks.length === 0) {
          return { content: [{ type: 'text', text: `No matching documents found for query: "${query}"` }] };
        }

        const results = chunks.map(chunk => ({
          documentTitle: chunk.documentTitle || chunk.title,
          content: chunk.content || chunk.text,
          score: chunk.score,
          metadata: {
            documentId: chunk.documentId,
            chunkIndex: chunk.chunkIndex,
            topics: chunk.topics,
            bankTypes: chunk.bankTypes,
          },
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify({
            query,
            resultCount: results.length,
            results,
          }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error searching documents: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };

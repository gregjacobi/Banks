const Institution = require('../../models/Institution');
const BankMetadata = require('../../models/BankMetadata');
const Source = require('../../models/Source');
const gridfs = require('../../config/gridfs');
const { listFilesInGridFS, loadJsonFromGridFS } = require('../../utils/gridfsHelpers');
const Anthropic = require('@anthropic-ai/sdk');

function register(server) {
  // get-research-report: load latest report from GridFS
  server.tool(
    'get-research-report',
    'Get the latest research report for a bank. Reports contain AI-generated analysis of the bank\'s financial performance, strategy, and outlook.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
    },
    async ({ idrssd }) => {
      try {
        const bucket = gridfs.documentBucket;
        const files = await listFilesInGridFS(bucket, {
          filename: { $regex: new RegExp('^' + idrssd + '_.*\\.json$') }
        });

        if (!files || files.length === 0) {
          return { content: [{ type: 'text', text: `No research report found for bank ${idrssd}.` }] };
        }

        // Sort by upload date descending (most recent first)
        files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        const report = await loadJsonFromGridFS(bucket, files[0].filename);

        const result = {
          filename: files[0].filename,
          uploadDate: files[0].uploadDate?.toISOString(),
          report,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching research report: ${error.message}` }], isError: true };
      }
    }
  );

  // get-bank-metadata: BankMetadata + Institution info
  server.tool(
    'get-bank-metadata',
    'Get metadata for a bank including strategic priorities, technology partnerships, key executives, and other qualitative information gathered from research.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
    },
    async ({ idrssd }) => {
      try {
        const [metadata, institution] = await Promise.all([
          BankMetadata.findOne({ idrssd }).lean(),
          Institution.findOne({ idrssd }).lean(),
        ]);

        if (!institution) {
          return { content: [{ type: 'text', text: `No bank found with idrssd '${idrssd}'.` }] };
        }

        const result = {
          institution: {
            idrssd: institution.idrssd,
            name: institution.name,
            city: institution.city,
            state: institution.state,
          },
          metadata: metadata || null,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching bank metadata: ${error.message}` }], isError: true };
      }
    }
  );

  // get-sources: get latest session's sources for a bank
  server.tool(
    'get-sources',
    'Get research sources collected for a bank. Returns the latest session\'s sources including URLs, titles, and content summaries.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
    },
    async ({ idrssd }) => {
      try {
        // Find the latest source for this bank to get its sessionId
        const latestSource = await Source.findOne({ idrssd })
          .sort({ foundAt: -1 })
          .lean();

        if (!latestSource) {
          return { content: [{ type: 'text', text: `No sources found for bank ${idrssd}.` }] };
        }

        // Get all sources from that session
        const sources = await Source.getBySession(latestSource.sessionId);

        const result = {
          sessionId: latestSource.sessionId,
          sourceCount: sources.length,
          sources: sources.map(s => ({
            title: s.title,
            url: s.url,
            category: s.category,
            status: s.status,
            documentType: s.documentType,
            foundAt: s.foundAt?.toISOString(),
          })),
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching sources: ${error.message}` }], isError: true };
      }
    }
  );

  // get-podcast-info: latest podcast from GridFS audio bucket
  server.tool(
    'get-podcast-info',
    'Get information about the latest podcast generated for a bank, including stream URL and metadata.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
    },
    async ({ idrssd }) => {
      try {
        const bucket = gridfs.audioBucket;
        const files = await listFilesInGridFS(bucket, {
          filename: { $regex: new RegExp('^(podcast_)?' + idrssd + '_.*\\.mp3$') }
        });

        if (!files || files.length === 0) {
          return { content: [{ type: 'text', text: `No podcast found for bank ${idrssd}.` }] };
        }

        // Sort by upload date descending
        files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        const latest = files[0];
        const result = {
          filename: latest.filename,
          uploadDate: latest.uploadDate?.toISOString(),
          fileSize: latest.length,
          streamUrl: `/api/research/${idrssd}/podcast/stream/${latest.filename}`,
          metadata: latest.metadata || {},
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching podcast info: ${error.message}` }], isError: true };
      }
    }
  );

  // get-presentation: latest presentation from GridFS
  server.tool(
    'get-presentation',
    'Get the latest presentation generated for a bank. Returns slide data and metadata.',
    {
      idrssd: { type: 'string', description: 'Bank ID' },
    },
    async ({ idrssd }) => {
      try {
        const bucket = gridfs.documentBucket;
        const files = await listFilesInGridFS(bucket, {
          filename: { $regex: new RegExp('^presentation_' + idrssd + '_.*\\.json$') }
        });

        if (!files || files.length === 0) {
          return { content: [{ type: 'text', text: `No presentation found for bank ${idrssd}.` }] };
        }

        // Sort by upload date descending
        files.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

        const presentation = await loadJsonFromGridFS(bucket, files[0].filename);

        const result = {
          filename: files[0].filename,
          uploadDate: files[0].uploadDate?.toISOString(),
          slideCount: presentation?.slides?.length || 0,
          presentation,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error fetching presentation: ${error.message}` }], isError: true };
      }
    }
  );

  // define-financial-term: Anthropic API call for banking term definition
  server.tool(
    'define-financial-term',
    'Get a clear definition and explanation of a banking or financial term. Useful for understanding metrics, ratios, and industry terminology.',
    {
      term: { type: 'string', description: 'The financial or banking term to define' },
    },
    async ({ term }) => {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

        const response = await anthropic.messages.create({
          model: 'fennec-v7-fast',
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: `You are a banking and financial expert. Provide a clear, concise definition and explanation of the following financial/banking term. Include:
1. A brief definition (1-2 sentences)
2. How it's calculated (if it's a ratio or metric)
3. Why it matters for bank analysis
4. What values are considered good vs concerning

Term: ${term}`
          }],
        });

        const definition = response.content[0]?.text || 'No definition generated.';

        return {
          content: [{ type: 'text', text: JSON.stringify({ term, definition }, null, 2) }],
        };
      } catch (error) {
        return { content: [{ type: 'text', text: `Error defining term: ${error.message}` }], isError: true };
      }
    }
  );
}

module.exports = { register };

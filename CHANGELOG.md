# Changelog

<!-- towncrier release notes start -->

## 1.0.0-alpha.1 (2026-07-26)

### Feature

- Prepare first alpha release. @tisto. @ericof [#22](https://github.com/plone/plone-mcp/issues/22)
- Add a markdown parser for text blocks, turning the markdown formatting supported by Volto into slate blocks. @danalvrz
- Add a single tool for adding blocks, exposing every available block and its schema in the tool description. @danalvrz
- Add a tool to manage translations of content. @Tishasoumya-02
- Add an llm_instructions field to the teaser block specification, so ambiguous prompts no longer produce blank teasers with an improvised href. @danalvrz
- Add support for configuring the server through environment variables. @danalvrz
- Add support for the grid block. @Tishasoumya-02
- Add support for the image block, validating that the given URL points to an actual image. @Tishasoumya-02
- Add support for the listing block and add tools for user management. @danalvrz
- Create a title block by default when creating a page. @tisto

### Bugfix

- Detect image URLs more reliably, checking the MIME type of data URLs and the Content-Type header of external ones. @Tishasoumya-02
- Fix bugs found during live end-to-end testing, including empty PATCH responses and navigation handling. @danalvrz
- Fix the specification for the image block widths. @danalvrz
- Fix updating a single block. @danalvrz

### Internal

- Declare the author, maintainers, homepage, repository and bugs metadata of the package. @ericof [#22](https://github.com/plone/plone-mcp/issues/22)
- Add a Makefile with targets for development, changelog and release tasks. @ericof [#22](https://github.com/plone/plone-mcp/issues/22)
- Add the MCP inspector to ease local debugging of the server. @danalvrz
- Add the MIT license to the project. @tisto
- Add the testing infrastructure for the project. @tisto
- Refactor the MCP server around the block specification. @danalvrz
- Refactor the project to follow the same structure as docs-mcp. @Tishasoumya-02
- Rename the package from plone-mcp-server to plone-mcp. @tisto

### Documentation

- Update the README and the configuration files so Claude Desktop can start the server without any extra setup. @danalvrz [#13](https://github.com/plone/plone-mcp/issues/13)
- Document the teaser block in BLOCK-TEASER.md. @tisto
- Update the repository URL used for cloning in the README. @pnicolli
- Use the HTTPS URL in the clone command documented in the README. @tisto

### Test

- Add GitHub Actions workflow to check for news fragments in pull requests. @ericof [#22](https://github.com/plone/plone-mcp/issues/22)
- Run the test suite on Node.js 22 and 24. @ericof [#22](https://github.com/plone/plone-mcp/issues/22)

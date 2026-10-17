process.once('message', async (workerData) => {
const { XmlDocument, XsdValidator, XmlBufferInputProvider, xmlRegisterInputProvider, ParseOption } = await import('libxml2-wasm');

// Only bundled, verified schemas are supplied. No network/OS input provider is registered.
const provider = new XmlBufferInputProvider(workerData.schemas);
xmlRegisterInputProvider({ match: () => true, open: (name) => provider.open(name), read: (fd, buf) => provider.read(fd, buf), close: (fd) => provider.close(fd) });
let schema;
let document;
let validator;
try {
  schema = XmlDocument.fromBuffer(workerData.schemas['/nfe/procNFe_v4.00.xsd'], { url: '/nfe/procNFe_v4.00.xsd', option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE });
  validator = XsdValidator.fromDoc(schema);
  document = XmlDocument.fromString(workerData.xml, { option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_XXE });
  validator.validate(document);
  process.send({ valid: true });
} catch (error) {
  // libxml2 errors can contain fiscal values. Only location/count crosses the worker boundary.
  process.send({ valid: false, issueCount: Math.min(error?.details?.length ?? 1, 20), lines: (error?.details ?? []).slice(0, 10).map((d) => d.line), code: validator ? 'XSD_VALIDATION_FAILED' : 'SCHEMA_CONFIGURATION_ERROR' });
} finally {
  document?.dispose();
  validator?.dispose();
  schema?.dispose();
  process.disconnect();
}
});

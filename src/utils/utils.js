function renderError(err) {
  if (err.response) {
    console.log({
      response: err.response.data,
      responseCode: err.response.status,
      responseHeaders: err.response.headers,
    });            
  }
  else if (err.request) {
    console.log('An unknown error occurred while sending request.');
    if (err.request._currentRequest && err.request._currentUrl) {
      console.log({
        requestUrl: err.request._currentUrl,
        requestMethod: err.request._currentRequest.method,
        requestHeaders: err.request._currentRequest._header
      });
    }
  }
  else {
    console.log(err);
  }
}

async function goToSleep(milliS) {
  return new Promise(resolve => setTimeout(resolve, milliS));
}

function resolveCfImportValue(provider, name) {
  return provider.request('CloudFormation', 'listExports').then(result => {
    const targetExportMeta = result.Exports.find(exportMeta => exportMeta.Name === name);
    if (targetExportMeta) return targetExportMeta.Value;
    if (result.NextToken) {
      return resolveCfImportValue(name, { NextToken: result.NextToken });
    }
    return null;
  });
}
  

module.exports = {
  renderError,
  goToSleep,
  resolveCfImportValue,
};

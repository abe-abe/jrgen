const fs = require("fs");
const path = require("path");
const json2ts = require("json-schema-to-typescript");

const utils = require(path.join(__dirname, "../../../", "utils.js"));

const templateDir = path.join(__dirname, "templates");
const templates = utils.loadTemplates(templateDir);

exports.generate = schemas => {
  return new Promise((resolve, reject) => {
    var schema = utils.mergeSchemas(schemas);

    buildClient(schema).then(ts => {
      var artifacts = {};
      artifacts["RPCClient.ts"] = Buffer.from(templates["client.ts"], "utf-8");
      artifacts[schema.info.title + "Client.ts"] = Buffer.from(ts, "utf-8");

      resolve(artifacts);
    });
  });
};

var buildClient = schema => {
  return new Promise((resolve, reject) => {
    var json2tsOptions = {
      bannerComment: "",
      style: {
        singleQuote: true
      }
    };

    var types = "";
    var methods = "";
    var promises = [];

    Object.keys(schema.methods).forEach(key => {
      methods += buildRPCMethod(key, schema.methods[key]) + "\n";

      if (schema.methods[key].params) {
        var promise = json2ts.compile(
          schema.methods[key].params,
          key.replace(/\./g, "") + "RpcParams.json",
          json2tsOptions
        );
        promise.then(ts => {
          types += ts + "\n\n";
        });
        promises.push(promise);
      }

      if (schema.methods[key].result) {
        var promise = json2ts.compile(
          schema.methods[key].result,
          key.replace(/\./g, "") + "RpcResult.json",
          json2tsOptions
        );
        promise.then(ts => {
          types += ts + "\n\n";
        });
        promises.push(promise);
      }
    });

    Object.keys(schema.definitions).forEach(key => {
      var promise = json2ts.compile(
        schema.definitions[key],
        key.replace(/\./g, "") + ".json",
        json2tsOptions
      );
      promise.then(ts => {
        types += ts + "\n\n";
      });
      promises.push(promise);
    });

    Promise.all(promises).then(() => {
      resolve(
        utils.populateTemplate(templates["base.ts"], {
          TITLE: schema.info.title + "Client",
          METHODS: methods,
          TYPES: types
        })
      );
    });
  });
};

var buildRPCMethod = (method, schema) => {
  var paramsType = "?:undefined";
  if (schema.params) {
    paramsType = ":" + method.replace(/\./g, "") + "RpcParams";
  }

  var resultType = "undefined";
  if (schema.result) {
    resultType = method.replace(/\./g, "") + "RpcResult";
  }

  return utils.populateTemplate(templates["method.ts"], {
    METHOD: method,
    NAME: method.replace(/\./g, "_"),
    PARAMS_TYPE: paramsType,
    RESULT_TYPE: resultType
  });
};

/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import {  fetchMiddlewares, ExpressTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { UserController } from './controllers/user.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { TransformerController } from './controllers/transformer.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { SouthConnectorController } from './controllers/south-connector.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ScanModeController } from './controllers/scan-mode.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { OIAnalyticsRegistrationController } from './controllers/oianalytics-registration.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { OIAnalyticsCommandController } from './controllers/oianalytics-command.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { NorthConnectorController } from './controllers/north-connector.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { LogController } from './controllers/log.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { IPFilterController } from './controllers/ip-filter.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { HistoryQueryController } from './controllers/history-query.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { EngineController } from './controllers/engine.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { ContentController } from './controllers/content.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { CertificateController } from './controllers/certificate.controller';
import type { Request as ExRequest, Response as ExResponse, RequestHandler, Router } from 'express';
const multer = require('multer');




// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "Language": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["fr"]},{"dataType":"enum","enums":["en"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Timezone": {
        "dataType": "refAlias",
        "type": {"dataType":"string","validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Instant": {
        "dataType": "refAlias",
        "type": {"dataType":"string","validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "login": {"dataType":"string","required":true},
            "firstName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "lastName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "email": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "language": {"ref":"Language","required":true},
            "timezone": {"ref":"Timezone","required":true},
            "friendlyName": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Page_UserDTO_": {
        "dataType": "refObject",
        "properties": {
            "content": {"dataType":"array","array":{"dataType":"refObject","ref":"UserDTO"},"required":true},
            "totalElements": {"dataType":"double","required":true},
            "size": {"dataType":"double","required":true},
            "number": {"dataType":"double","required":true},
            "totalPages": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "login": {"dataType":"string","required":true},
            "firstName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "lastName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "email": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "language": {"ref":"Language","required":true},
            "timezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserWithPassword": {
        "dataType": "refObject",
        "properties": {
            "user": {"ref":"UserCommandDTO","required":true},
            "password": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ChangePasswordCommand": {
        "dataType": "refObject",
        "properties": {
            "currentPassword": {"dataType":"string","required":true},
            "newPassword": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusObjectAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["object"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "attributes": {"dataType":"array","array":{"dataType":"refAlias","ref":"OIBusAttribute"},"required":true},
            "enablingConditions": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusEnablingCondition"},"required":true},
            "displayProperties": {"ref":"OIBusObjectDisplayProperties","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusAttributeDisplayProperties": {
        "dataType": "refObject",
        "properties": {
            "row": {"dataType":"double","required":true},
            "columns": {"dataType":"double","required":true},
            "displayInViewMode": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusAttributeType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["number"]},{"dataType":"enum","enums":["boolean"]},{"dataType":"enum","enums":["object"]},{"dataType":"enum","enums":["instant"]},{"dataType":"enum","enums":["string-select"]},{"dataType":"enum","enums":["secret"]},{"dataType":"enum","enums":["code"]},{"dataType":"enum","enums":["scan-mode"]},{"dataType":"enum","enums":["transformer-array"]},{"dataType":"enum","enums":["certificate"]},{"dataType":"enum","enums":["timezone"]},{"dataType":"enum","enums":["array"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusAttributeValidatorType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["REQUIRED"]},{"dataType":"enum","enums":["MINIMUM"]},{"dataType":"enum","enums":["MAXIMUM"]},{"dataType":"enum","enums":["POSITIVE_INTEGER"]},{"dataType":"enum","enums":["VALID_CRON"]},{"dataType":"enum","enums":["PATTERN"]},{"dataType":"enum","enums":["UNIQUE"]},{"dataType":"enum","enums":["SINGLE_TRUE"]},{"dataType":"enum","enums":["MQTT_TOPIC_OVERLAP"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusAttributeValidator": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"OIBusAttributeValidatorType","required":true},
            "arguments": {"dataType":"array","array":{"dataType":"string"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusStringAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["string"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "defaultValue": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCodeAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["code"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "contentType": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["sql"]},{"dataType":"enum","enums":["json"]}],"required":true},
            "defaultValue": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusStringSelectAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["string-select"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "selectableValues": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "defaultValue": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusSecretAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["secret"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusNumberAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["number"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "defaultValue": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "unit": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusBooleanAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["boolean"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "defaultValue": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusInstantAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["instant"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusScanModeAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["scan-mode"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "acceptableType": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["POLL"]},{"dataType":"enum","enums":["SUBSCRIPTION_AND_POLL"]},{"dataType":"enum","enums":["SUBSCRIPTION"]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCertificateAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["certificate"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTimezoneAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["timezone"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "displayProperties": {"ref":"OIBusAttributeDisplayProperties","required":true},
            "defaultValue": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusArrayAttribute": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["array"],"required":true},
            "key": {"dataType":"string","required":true},
            "translationKey": {"dataType":"string","required":true},
            "validators": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusAttributeValidator"},"required":true},
            "paginate": {"dataType":"boolean","required":true},
            "numberOfElementPerPage": {"dataType":"double","required":true},
            "rootAttribute": {"ref":"OIBusObjectAttribute","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusAttribute": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"OIBusObjectAttribute"},{"ref":"OIBusStringAttribute"},{"ref":"OIBusCodeAttribute"},{"ref":"OIBusStringSelectAttribute"},{"ref":"OIBusSecretAttribute"},{"ref":"OIBusNumberAttribute"},{"ref":"OIBusBooleanAttribute"},{"ref":"OIBusInstantAttribute"},{"ref":"OIBusScanModeAttribute"},{"ref":"OIBusCertificateAttribute"},{"ref":"OIBusTimezoneAttribute"},{"ref":"OIBusArrayAttribute"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusEnablingCondition": {
        "dataType": "refObject",
        "properties": {
            "targetPathFromRoot": {"dataType":"string","required":true},
            "referralPathFromRoot": {"dataType":"string","required":true},
            "values": {"dataType":"array","array":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"double"},{"dataType":"boolean"}]},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusObjectDisplayProperties": {
        "dataType": "refObject",
        "properties": {
            "visible": {"dataType":"boolean","required":true},
            "wrapInBox": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CustomTransformerDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["custom"],"required":true},
            "inputType": {"dataType":"string","required":true},
            "outputType": {"dataType":"string","required":true},
            "manifest": {"ref":"OIBusObjectAttribute","required":true},
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "customCode": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StandardTransformerDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["standard"],"required":true},
            "inputType": {"dataType":"string","required":true},
            "outputType": {"dataType":"string","required":true},
            "manifest": {"ref":"OIBusObjectAttribute","required":true},
            "functionName": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TransformerDTO": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"CustomTransformerDTO"},{"ref":"StandardTransformerDTO"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Page_TransformerDTO_": {
        "dataType": "refObject",
        "properties": {
            "content": {"dataType":"array","array":{"dataType":"refAlias","ref":"TransformerDTO"},"required":true},
            "totalElements": {"dataType":"double","required":true},
            "size": {"dataType":"double","required":true},
            "number": {"dataType":"double","required":true},
            "totalPages": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDataType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["any"]},{"dataType":"enum","enums":["time-values"]},{"dataType":"enum","enums":["setpoint"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CustomTransformerCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["custom"],"required":true},
            "inputType": {"dataType":"string","required":true},
            "outputType": {"dataType":"string","required":true},
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "customCode": {"dataType":"string","required":true},
            "customManifest": {"ref":"OIBusObjectAttribute","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusSouthType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["ads"]},{"dataType":"enum","enums":["folder-scanner"]},{"dataType":"enum","enums":["ftp"]},{"dataType":"enum","enums":["modbus"]},{"dataType":"enum","enums":["mqtt"]},{"dataType":"enum","enums":["mssql"]},{"dataType":"enum","enums":["mysql"]},{"dataType":"enum","enums":["odbc"]},{"dataType":"enum","enums":["oianalytics"]},{"dataType":"enum","enums":["oledb"]},{"dataType":"enum","enums":["opc"]},{"dataType":"enum","enums":["opcua"]},{"dataType":"enum","enums":["oracle"]},{"dataType":"enum","enums":["osisoft-pi"]},{"dataType":"enum","enums":["postgresql"]},{"dataType":"enum","enums":["sftp"]},{"dataType":"enum","enums":["sqlite"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusSouthCategory": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["file"]},{"dataType":"enum","enums":["iot"]},{"dataType":"enum","enums":["database"]},{"dataType":"enum","enums":["api"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthType": {
        "dataType": "refObject",
        "properties": {
            "id": {"ref":"OIBusSouthType","required":true},
            "category": {"ref":"OIBusSouthCategory","required":true},
            "modes": {"dataType":"nestedObjectLiteral","nestedProperties":{"history":{"dataType":"boolean","required":true},"lastFile":{"dataType":"boolean","required":true},"lastPoint":{"dataType":"boolean","required":true},"subscription":{"dataType":"boolean","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorManifest": {
        "dataType": "refObject",
        "properties": {
            "id": {"ref":"OIBusSouthType","required":true},
            "category": {"ref":"OIBusSouthCategory","required":true},
            "modes": {"dataType":"nestedObjectLiteral","nestedProperties":{"history":{"dataType":"boolean","required":true},"lastFile":{"dataType":"boolean","required":true},"lastPoint":{"dataType":"boolean","required":true},"subscription":{"dataType":"boolean","required":true}},"required":true},
            "settings": {"ref":"OIBusObjectAttribute","required":true},
            "items": {"ref":"OIBusArrayAttribute","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorLightDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "type": {"ref":"OIBusSouthType","required":true},
            "description": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthADSSettingsEnumAsText": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["text"]},{"dataType":"enum","enums":["integer"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthADSSettingsBoolAsText": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["text"]},{"dataType":"enum","enums":["integer"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthADSSettingsStructureFiltering": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "fields": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthADSSettings": {
        "dataType": "refObject",
        "properties": {
            "netId": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "routerAddress": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "routerTcpPort": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "clientAmsNetId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "clientAdsPort": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "retryInterval": {"dataType":"double","required":true},
            "plcName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "enumAsText": {"ref":"SouthADSSettingsEnumAsText","required":true},
            "boolAsText": {"ref":"SouthADSSettingsBoolAsText","required":true},
            "structureFiltering": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthADSSettingsStructureFiltering"}},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthFolderScannerSettings": {
        "dataType": "refObject",
        "properties": {
            "inputFolder": {"dataType":"string","required":true},
            "compression": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthFTPSettingsAuthentication": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["password"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthFTPSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "authentication": {"ref":"SouthFTPSettingsAuthentication","required":true},
            "username": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "compression": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusSettingsAddressOffset": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["modbus"]},{"dataType":"enum","enums":["jbus"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusSettingsEndianness": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["big-endian"]},{"dataType":"enum","enums":["little-endian"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "slaveId": {"dataType":"double","required":true},
            "addressOffset": {"ref":"SouthModbusSettingsAddressOffset","required":true},
            "endianness": {"ref":"SouthModbusSettingsEndianness","required":true},
            "swapBytesInWords": {"dataType":"boolean","required":true},
            "swapWordsInDWords": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTSettingsQos": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["0"]},{"dataType":"enum","enums":["1"]},{"dataType":"enum","enums":["2"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTSettingsAuthenticationType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["cert"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTSettingsAuthentication": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthMQTTSettingsAuthenticationType","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "certFilePath": {"dataType":"string"},
            "keyFilePath": {"dataType":"string"},
            "caFilePath": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTSettings": {
        "dataType": "refObject",
        "properties": {
            "url": {"dataType":"string","required":true},
            "qos": {"ref":"SouthMQTTSettingsQos","required":true},
            "persistent": {"dataType":"boolean"},
            "authentication": {"ref":"SouthMQTTSettingsAuthentication","required":true},
            "rejectUnauthorized": {"dataType":"boolean","required":true},
            "reconnectPeriod": {"dataType":"double","required":true},
            "connectTimeout": {"dataType":"double","required":true},
            "maxNumberOfMessages": {"dataType":"double","required":true},
            "flushMessageTimeout": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthMSSQLSettingsThrottling","required":true},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "connectionTimeout": {"dataType":"double","required":true},
            "database": {"dataType":"string","required":true},
            "encryption": {"dataType":"boolean","required":true},
            "trustServerCertificate": {"dataType":"boolean","required":true},
            "username": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "domain": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "requestTimeout": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthMySQLSettingsThrottling","required":true},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "connectionTimeout": {"dataType":"double","required":true},
            "database": {"dataType":"string","required":true},
            "username": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthODBCSettingsThrottling","required":true},
            "remoteAgent": {"dataType":"boolean","required":true},
            "agentUrl": {"dataType":"string"},
            "connectionTimeout": {"dataType":"double","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "requestTimeout": {"dataType":"double"},
            "connectionString": {"dataType":"string","required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsSettingsSpecificSettingsAuthentication": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["aad-client-secret"]},{"dataType":"enum","enums":["aad-certificate"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsSettingsSpecificSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "acceptUnauthorized": {"dataType":"boolean","required":true},
            "authentication": {"ref":"SouthOIAnalyticsSettingsSpecificSettingsAuthentication","required":true},
            "accessKey": {"dataType":"string"},
            "secretKey": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "tenantId": {"dataType":"string"},
            "clientId": {"dataType":"string"},
            "clientSecret": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "certificateId": {"dataType":"string"},
            "scope": {"dataType":"string"},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"string"},
            "proxyUsername": {"dataType":"string"},
            "proxyPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthOIAnalyticsSettingsThrottling","required":true},
            "useOiaModule": {"dataType":"boolean","required":true},
            "timeout": {"dataType":"double","required":true},
            "specificSettings": {"dataType":"union","subSchemas":[{"ref":"SouthOIAnalyticsSettingsSpecificSettings"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthOLEDBSettingsThrottling","required":true},
            "agentUrl": {"dataType":"string","required":true},
            "connectionTimeout": {"dataType":"double","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "requestTimeout": {"dataType":"double","required":true},
            "connectionString": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
            "maxInstantPerItem": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCSettingsMode": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["hda"]},{"dataType":"enum","enums":["da"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthOPCSettingsThrottling","required":true},
            "agentUrl": {"dataType":"string","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "host": {"dataType":"string","required":true},
            "serverName": {"dataType":"string","required":true},
            "mode": {"ref":"SouthOPCSettingsMode","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUASettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
            "maxInstantPerItem": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUASettingsSecurityMode": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["sign"]},{"dataType":"enum","enums":["sign-and-encrypt"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUASettingsSecurityPolicy": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["basic128"]},{"dataType":"enum","enums":["basic192"]},{"dataType":"enum","enums":["basic192-rsa15"]},{"dataType":"enum","enums":["basic256-rsa15"]},{"dataType":"enum","enums":["basic256-sha256"]},{"dataType":"enum","enums":["aes128-sha256-rsa-oaep"]},{"dataType":"enum","enums":["pub-sub-aes-128-ctr"]},{"dataType":"enum","enums":["pub-sub-aes-256-ctr"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUASettingsAuthenticationType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["cert"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUASettingsAuthentication": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthOPCUASettingsAuthenticationType","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "certFilePath": {"dataType":"string"},
            "keyFilePath": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUASettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthOPCUASettingsThrottling","required":true},
            "sharedConnection": {"dataType":"boolean","required":true},
            "url": {"dataType":"string","required":true},
            "keepSessionAlive": {"dataType":"boolean","required":true},
            "readTimeout": {"dataType":"double","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "securityMode": {"ref":"SouthOPCUASettingsSecurityMode","required":true},
            "securityPolicy": {"ref":"SouthOPCUASettingsSecurityPolicy"},
            "authentication": {"ref":"SouthOPCUASettingsAuthentication","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthOracleSettingsThrottling","required":true},
            "thickMode": {"dataType":"boolean","required":true},
            "oracleClient": {"dataType":"string"},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "connectionTimeout": {"dataType":"double","required":true},
            "database": {"dataType":"string","required":true},
            "username": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPISettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
            "maxInstantPerItem": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPISettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthPISettingsThrottling","required":true},
            "agentUrl": {"dataType":"string","required":true},
            "retryInterval": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthPostgreSQLSettingsThrottling","required":true},
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "sslMode": {"dataType":"boolean","required":true},
            "database": {"dataType":"string","required":true},
            "connectionTimeout": {"dataType":"double","required":true},
            "requestTimeout": {"dataType":"double","required":true},
            "username": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSFTPSettingsAuthentication": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["password"]},{"dataType":"enum","enums":["private-key"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSFTPSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "authentication": {"ref":"SouthSFTPSettingsAuthentication","required":true},
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "privateKey": {"dataType":"string"},
            "passphrase": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "compression": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteSettingsThrottling": {
        "dataType": "refObject",
        "properties": {
            "maxReadInterval": {"dataType":"double","required":true},
            "readDelay": {"dataType":"double","required":true},
            "overlap": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteSettings": {
        "dataType": "refObject",
        "properties": {
            "throttling": {"ref":"SouthSQLiteSettingsThrottling","required":true},
            "databasePath": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSettings": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"SouthADSSettings"},{"ref":"SouthFolderScannerSettings"},{"ref":"SouthFTPSettings"},{"ref":"SouthModbusSettings"},{"ref":"SouthMQTTSettings"},{"ref":"SouthMSSQLSettings"},{"ref":"SouthMySQLSettings"},{"ref":"SouthODBCSettings"},{"ref":"SouthOIAnalyticsSettings"},{"ref":"SouthOLEDBSettings"},{"ref":"SouthOPCSettings"},{"ref":"SouthOPCUASettings"},{"ref":"SouthOracleSettings"},{"ref":"SouthPISettings"},{"ref":"SouthPostgreSQLSettings"},{"ref":"SouthSFTPSettings"},{"ref":"SouthSQLiteSettings"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthADSItemSettings": {
        "dataType": "refObject",
        "properties": {
            "address": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthFolderScannerItemSettings": {
        "dataType": "refObject",
        "properties": {
            "regex": {"dataType":"string","required":true},
            "minAge": {"dataType":"double","required":true},
            "preserveFiles": {"dataType":"boolean","required":true},
            "ignoreModifiedDate": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthFTPItemSettings": {
        "dataType": "refObject",
        "properties": {
            "remoteFolder": {"dataType":"string","required":true},
            "regex": {"dataType":"string","required":true},
            "minAge": {"dataType":"double","required":true},
            "preserveFiles": {"dataType":"boolean","required":true},
            "ignoreModifiedDate": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusItemSettingsModbusType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["coil"]},{"dataType":"enum","enums":["discrete-input"]},{"dataType":"enum","enums":["input-register"]},{"dataType":"enum","enums":["holding-register"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusItemSettingsDataDataType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["uint16"]},{"dataType":"enum","enums":["int16"]},{"dataType":"enum","enums":["uint32"]},{"dataType":"enum","enums":["int32"]},{"dataType":"enum","enums":["big-uint64"]},{"dataType":"enum","enums":["big-int64"]},{"dataType":"enum","enums":["float"]},{"dataType":"enum","enums":["double"]},{"dataType":"enum","enums":["bit"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusItemSettingsData": {
        "dataType": "refObject",
        "properties": {
            "dataType": {"ref":"SouthModbusItemSettingsDataDataType","required":true},
            "bitIndex": {"dataType":"double"},
            "multiplierCoefficient": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthModbusItemSettings": {
        "dataType": "refObject",
        "properties": {
            "address": {"dataType":"string","required":true},
            "modbusType": {"ref":"SouthModbusItemSettingsModbusType","required":true},
            "data": {"dataType":"union","subSchemas":[{"ref":"SouthModbusItemSettingsData"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsValueType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["number"]},{"dataType":"enum","enums":["json"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsJsonPayloadPointIdOrigin": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["oibus"]},{"dataType":"enum","enums":["payload"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsJsonPayloadTimestampOrigin": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["oibus"]},{"dataType":"enum","enums":["payload"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsJsonPayloadTimestampPayloadTimestampType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsJsonPayloadTimestampPayload": {
        "dataType": "refObject",
        "properties": {
            "timestampPath": {"dataType":"string","required":true},
            "timestampType": {"ref":"SouthMQTTItemSettingsJsonPayloadTimestampPayloadTimestampType","required":true},
            "timestampFormat": {"dataType":"string"},
            "timezone": {"ref":"Timezone"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsJsonPayloadOtherFields": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "path": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettingsJsonPayload": {
        "dataType": "refObject",
        "properties": {
            "useArray": {"dataType":"boolean","required":true},
            "dataArrayPath": {"dataType":"string"},
            "valuePath": {"dataType":"string","required":true},
            "pointIdOrigin": {"ref":"SouthMQTTItemSettingsJsonPayloadPointIdOrigin","required":true},
            "pointIdPath": {"dataType":"string"},
            "timestampOrigin": {"ref":"SouthMQTTItemSettingsJsonPayloadTimestampOrigin","required":true},
            "timestampPayload": {"dataType":"union","subSchemas":[{"ref":"SouthMQTTItemSettingsJsonPayloadTimestampPayload"},{"dataType":"enum","enums":[null]}]},
            "otherFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthMQTTItemSettingsJsonPayloadOtherFields"}},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMQTTItemSettings": {
        "dataType": "refObject",
        "properties": {
            "topic": {"dataType":"string","required":true},
            "valueType": {"ref":"SouthMQTTItemSettingsValueType","required":true},
            "jsonPayload": {"dataType":"union","subSchemas":[{"ref":"SouthMQTTItemSettingsJsonPayload"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]},{"dataType":"enum","enums":["date"]},{"dataType":"enum","enums":["date-time"]},{"dataType":"enum","enums":["date-time-2"]},{"dataType":"enum","enums":["date-time-offset"]},{"dataType":"enum","enums":["small-date-time"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthMSSQLItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthMSSQLItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthMSSQLItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMSSQLItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthMSSQLItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthMSSQLItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]},{"dataType":"enum","enums":["date-time"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthMySQLItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthMySQLItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthMySQLItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthMySQLItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "requestTimeout": {"dataType":"double","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthMySQLItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthMySQLItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthODBCItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthODBCItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthODBCItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthODBCItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthODBCItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthODBCItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsItemSettingsQueryParams": {
        "dataType": "refObject",
        "properties": {
            "key": {"dataType":"string","required":true},
            "value": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthOIAnalyticsItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthOIAnalyticsItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOIAnalyticsItemSettings": {
        "dataType": "refObject",
        "properties": {
            "endpoint": {"dataType":"string","required":true},
            "queryParams": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthOIAnalyticsItemSettingsQueryParams"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthOIAnalyticsItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthOLEDBItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthOLEDBItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthOLEDBItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOLEDBItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthOLEDBItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthOLEDBItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCItemSettingsAggregate": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["raw"]},{"dataType":"enum","enums":["interpolative"]},{"dataType":"enum","enums":["total"]},{"dataType":"enum","enums":["average"]},{"dataType":"enum","enums":["time-average"]},{"dataType":"enum","enums":["count"]},{"dataType":"enum","enums":["stdev"]},{"dataType":"enum","enums":["minimum-actual-time"]},{"dataType":"enum","enums":["minimum"]},{"dataType":"enum","enums":["maximum-actual-time"]},{"dataType":"enum","enums":["maximum"]},{"dataType":"enum","enums":["start"]},{"dataType":"enum","enums":["end"]},{"dataType":"enum","enums":["delta"]},{"dataType":"enum","enums":["reg-slope"]},{"dataType":"enum","enums":["reg-const"]},{"dataType":"enum","enums":["reg-dev"]},{"dataType":"enum","enums":["variance"]},{"dataType":"enum","enums":["range"]},{"dataType":"enum","enums":["duration-good"]},{"dataType":"enum","enums":["duration-bad"]},{"dataType":"enum","enums":["percent-good"]},{"dataType":"enum","enums":["percent-bad"]},{"dataType":"enum","enums":["worst-quality"]},{"dataType":"enum","enums":["annotations"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCItemSettingsResampling": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["1s"]},{"dataType":"enum","enums":["10s"]},{"dataType":"enum","enums":["30s"]},{"dataType":"enum","enums":["1min"]},{"dataType":"enum","enums":["1h"]},{"dataType":"enum","enums":["1d"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCItemSettings": {
        "dataType": "refObject",
        "properties": {
            "nodeId": {"dataType":"string","required":true},
            "aggregate": {"ref":"SouthOPCItemSettingsAggregate","required":true},
            "resampling": {"ref":"SouthOPCItemSettingsResampling"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUAItemSettingsMode": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["da"]},{"dataType":"enum","enums":["ha"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUAItemSettingsHaModeAggregate": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["raw"]},{"dataType":"enum","enums":["average"]},{"dataType":"enum","enums":["count"]},{"dataType":"enum","enums":["minimum"]},{"dataType":"enum","enums":["maximum"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUAItemSettingsHaModeResampling": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["1s"]},{"dataType":"enum","enums":["10s"]},{"dataType":"enum","enums":["30s"]},{"dataType":"enum","enums":["1min"]},{"dataType":"enum","enums":["1h"]},{"dataType":"enum","enums":["1d"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUAItemSettingsHaMode": {
        "dataType": "refObject",
        "properties": {
            "aggregate": {"ref":"SouthOPCUAItemSettingsHaModeAggregate","required":true},
            "resampling": {"ref":"SouthOPCUAItemSettingsHaModeResampling"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUAItemSettingsTimestampOrigin": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["oibus"]},{"dataType":"enum","enums":["point"]},{"dataType":"enum","enums":["server"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOPCUAItemSettings": {
        "dataType": "refObject",
        "properties": {
            "nodeId": {"dataType":"string","required":true},
            "mode": {"ref":"SouthOPCUAItemSettingsMode","required":true},
            "haMode": {"dataType":"union","subSchemas":[{"ref":"SouthOPCUAItemSettingsHaMode"},{"dataType":"enum","enums":[null]}]},
            "timestampOrigin": {"ref":"SouthOPCUAItemSettingsTimestampOrigin"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]},{"dataType":"enum","enums":["date-time"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthOracleItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthOracleItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthOracleItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthOracleItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "requestTimeout": {"dataType":"double","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthOracleItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthOracleItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPIItemSettingsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["point-id"]},{"dataType":"enum","enums":["point-query"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPIItemSettings": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthPIItemSettingsType","required":true},
            "piPoint": {"dataType":"string"},
            "piQuery": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]},{"dataType":"enum","enums":["timestamp"]},{"dataType":"enum","enums":["timestamptz"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthPostgreSQLItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthPostgreSQLItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthPostgreSQLItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthPostgreSQLItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthPostgreSQLItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthPostgreSQLItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSFTPItemSettings": {
        "dataType": "refObject",
        "properties": {
            "remoteFolder": {"dataType":"string","required":true},
            "regex": {"dataType":"string","required":true},
            "minAge": {"dataType":"double","required":true},
            "preserveFiles": {"dataType":"boolean","required":true},
            "ignoreModifiedDate": {"dataType":"boolean"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteItemSettingsDateTimeFieldsType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["string"]},{"dataType":"enum","enums":["iso-string"]},{"dataType":"enum","enums":["unix-epoch"]},{"dataType":"enum","enums":["unix-epoch-ms"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteItemSettingsDateTimeFields": {
        "dataType": "refObject",
        "properties": {
            "fieldName": {"dataType":"string","required":true},
            "useAsReference": {"dataType":"boolean","required":true},
            "type": {"ref":"SouthSQLiteItemSettingsDateTimeFieldsType","required":true},
            "timezone": {"ref":"Timezone"},
            "format": {"dataType":"string"},
            "locale": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteItemSettingsSerializationType": {
        "dataType": "refAlias",
        "type": {"dataType":"enum","enums":["csv"],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteItemSettingsSerializationDelimiter": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["DOT"]},{"dataType":"enum","enums":["SEMI_COLON"]},{"dataType":"enum","enums":["COLON"]},{"dataType":"enum","enums":["COMMA"]},{"dataType":"enum","enums":["NON_BREAKING_SPACE"]},{"dataType":"enum","enums":["SLASH"]},{"dataType":"enum","enums":["TAB"]},{"dataType":"enum","enums":["PIPE"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteItemSettingsSerialization": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"SouthSQLiteItemSettingsSerializationType","required":true},
            "filename": {"dataType":"string","required":true},
            "delimiter": {"ref":"SouthSQLiteItemSettingsSerializationDelimiter","required":true},
            "compression": {"dataType":"boolean","required":true},
            "outputTimestampFormat": {"dataType":"string","required":true},
            "outputTimezone": {"ref":"Timezone","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthSQLiteItemSettings": {
        "dataType": "refObject",
        "properties": {
            "query": {"dataType":"string","required":true},
            "dateTimeFields": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"SouthSQLiteItemSettingsDateTimeFields"}},{"dataType":"enum","enums":[null]}],"required":true},
            "serialization": {"ref":"SouthSQLiteItemSettingsSerialization","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthItemSettings": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"SouthADSItemSettings"},{"ref":"SouthFolderScannerItemSettings"},{"ref":"SouthFTPItemSettings"},{"ref":"SouthModbusItemSettings"},{"ref":"SouthMQTTItemSettings"},{"ref":"SouthMSSQLItemSettings"},{"ref":"SouthMySQLItemSettings"},{"ref":"SouthODBCItemSettings"},{"ref":"SouthOIAnalyticsItemSettings"},{"ref":"SouthOLEDBItemSettings"},{"ref":"SouthOPCItemSettings"},{"ref":"SouthOPCUAItemSettings"},{"ref":"SouthOracleItemSettings"},{"ref":"SouthPIItemSettings"},{"ref":"SouthPostgreSQLItemSettings"},{"ref":"SouthSFTPItemSettings"},{"ref":"SouthSQLiteItemSettings"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ScanModeDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "cron": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorItemDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"SouthItemSettings","required":true},
            "scanMode": {"ref":"ScanModeDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "type": {"ref":"OIBusSouthType","required":true},
            "description": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"SouthSettings","required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"SouthConnectorItemDTO"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorItemCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "enabled": {"dataType":"boolean","required":true},
            "name": {"dataType":"string","required":true},
            "settings": {"ref":"SouthItemSettings","required":true},
            "scanModeId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "scanModeName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "type": {"ref":"OIBusSouthType","required":true},
            "description": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"SouthSettings","required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"SouthConnectorItemCommandDTO"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTimeValue": {
        "dataType": "refObject",
        "properties": {
            "pointId": {"dataType":"string","required":true},
            "timestamp": {"ref":"Instant","required":true},
            "data": {"dataType":"nestedObjectLiteral","nestedProperties":{"value":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"double"}],"required":true}},"additionalProperties":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"double"}]},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTimeValueContent": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["time-values"],"required":true},
            "content": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusTimeValue"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusRawContent": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["any"],"required":true},
            "filePath": {"dataType":"string","required":true},
            "content": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusSetpoint": {
        "dataType": "refObject",
        "properties": {
            "reference": {"dataType":"string","required":true},
            "value": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"double"},{"dataType":"boolean"}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusSetpointContent": {
        "dataType": "refObject",
        "properties": {
            "type": {"dataType":"enum","enums":["setpoint"],"required":true},
            "content": {"dataType":"array","array":{"dataType":"refObject","ref":"OIBusSetpoint"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusContent": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"OIBusTimeValueContent"},{"ref":"OIBusRawContent"},{"ref":"OIBusSetpointContent"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthConnectorItemTestingSettings": {
        "dataType": "refObject",
        "properties": {
            "history": {"dataType":"union","subSchemas":[{"dataType":"nestedObjectLiteral","nestedProperties":{"endTime":{"dataType":"string","required":true},"startTime":{"dataType":"string","required":true}}},{"dataType":"undefined"}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthItemTestRequest": {
        "dataType": "refObject",
        "properties": {
            "southSettings": {"ref":"SouthSettings","required":true},
            "itemSettings": {"ref":"SouthItemSettings","required":true},
            "testingSettings": {"ref":"SouthConnectorItemTestingSettings","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Page_SouthConnectorItemDTO_": {
        "dataType": "refObject",
        "properties": {
            "content": {"dataType":"array","array":{"dataType":"refObject","ref":"SouthConnectorItemDTO"},"required":true},
            "totalElements": {"dataType":"double","required":true},
            "size": {"dataType":"double","required":true},
            "number": {"dataType":"double","required":true},
            "totalPages": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthCsvDelimiterRequest": {
        "dataType": "refObject",
        "properties": {
            "delimiter": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_string.string_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"string"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "SouthCsvImportResponse": {
        "dataType": "refObject",
        "properties": {
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"SouthConnectorItemDTO"},"required":true},
            "errors": {"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true},"item":{"ref":"Record_string.string_","required":true}}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ScanModeCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "cron": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ValidatedCronExpression": {
        "dataType": "refObject",
        "properties": {
            "isValid": {"dataType":"boolean","required":true},
            "errorMessage": {"dataType":"string","required":true},
            "nextExecutions": {"dataType":"array","array":{"dataType":"refAlias","ref":"Instant"},"required":true},
            "humanReadableForm": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RegistrationStatus": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["NOT_REGISTERED"]},{"dataType":"enum","enums":["PENDING"]},{"dataType":"enum","enums":["REGISTERED"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RegistrationSettingsDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "host": {"dataType":"string","required":true},
            "activationCode": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "status": {"ref":"RegistrationStatus","required":true},
            "activationDate": {"ref":"Instant","required":true},
            "activationExpirationDate": {"ref":"Instant"},
            "checkUrl": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "proxyUsername": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "acceptUnauthorized": {"dataType":"boolean","required":true},
            "commandRefreshInterval": {"dataType":"double","required":true},
            "commandRetryInterval": {"dataType":"double","required":true},
            "messageRetryInterval": {"dataType":"double","required":true},
            "commandPermissions": {"dataType":"nestedObjectLiteral","nestedProperties":{"setpoint":{"dataType":"boolean","required":true},"deleteNorth":{"dataType":"boolean","required":true},"updateNorth":{"dataType":"boolean","required":true},"createNorth":{"dataType":"boolean","required":true},"createOrUpdateSouthItemsFromCsv":{"dataType":"boolean","required":true},"deleteSouth":{"dataType":"boolean","required":true},"updateSouth":{"dataType":"boolean","required":true},"createSouth":{"dataType":"boolean","required":true},"createOrUpdateHistoryItemsFromCsv":{"dataType":"boolean","required":true},"deleteHistoryQuery":{"dataType":"boolean","required":true},"updateHistoryQuery":{"dataType":"boolean","required":true},"createHistoryQuery":{"dataType":"boolean","required":true},"deleteCertificate":{"dataType":"boolean","required":true},"updateCertificate":{"dataType":"boolean","required":true},"createCertificate":{"dataType":"boolean","required":true},"deleteIpFilter":{"dataType":"boolean","required":true},"updateIpFilter":{"dataType":"boolean","required":true},"createIpFilter":{"dataType":"boolean","required":true},"deleteScanMode":{"dataType":"boolean","required":true},"updateScanMode":{"dataType":"boolean","required":true},"createScanMode":{"dataType":"boolean","required":true},"updateRegistrationSettings":{"dataType":"boolean","required":true},"updateEngineSettings":{"dataType":"boolean","required":true},"regenerateCipherKeys":{"dataType":"boolean","required":true},"restartEngine":{"dataType":"boolean","required":true},"updateVersion":{"dataType":"boolean","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RegistrationSettingsCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "proxyUsername": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "proxyPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "acceptUnauthorized": {"dataType":"boolean","required":true},
            "commandRefreshInterval": {"dataType":"double","required":true},
            "commandRetryInterval": {"dataType":"double","required":true},
            "messageRetryInterval": {"dataType":"double","required":true},
            "commandPermissions": {"dataType":"nestedObjectLiteral","nestedProperties":{"setpoint":{"dataType":"boolean","required":true},"testNorthConnection":{"dataType":"boolean","required":true},"deleteNorth":{"dataType":"boolean","required":true},"updateNorth":{"dataType":"boolean","required":true},"createNorth":{"dataType":"boolean","required":true},"testSouthItem":{"dataType":"boolean","required":true},"testSouthConnection":{"dataType":"boolean","required":true},"createOrUpdateSouthItemsFromCsv":{"dataType":"boolean","required":true},"deleteSouth":{"dataType":"boolean","required":true},"updateSouth":{"dataType":"boolean","required":true},"createSouth":{"dataType":"boolean","required":true},"testHistorySouthItem":{"dataType":"boolean","required":true},"testHistorySouthConnection":{"dataType":"boolean","required":true},"testHistoryNorthConnection":{"dataType":"boolean","required":true},"createOrUpdateHistoryItemsFromCsv":{"dataType":"boolean","required":true},"deleteHistoryQuery":{"dataType":"boolean","required":true},"updateHistoryQuery":{"dataType":"boolean","required":true},"createHistoryQuery":{"dataType":"boolean","required":true},"deleteCertificate":{"dataType":"boolean","required":true},"updateCertificate":{"dataType":"boolean","required":true},"createCertificate":{"dataType":"boolean","required":true},"deleteIpFilter":{"dataType":"boolean","required":true},"updateIpFilter":{"dataType":"boolean","required":true},"createIpFilter":{"dataType":"boolean","required":true},"deleteScanMode":{"dataType":"boolean","required":true},"updateScanMode":{"dataType":"boolean","required":true},"createScanMode":{"dataType":"boolean","required":true},"updateRegistrationSettings":{"dataType":"boolean","required":true},"updateEngineSettings":{"dataType":"boolean","required":true},"regenerateCipherKeys":{"dataType":"boolean","required":true},"restartEngine":{"dataType":"boolean","required":true},"updateVersion":{"dataType":"boolean","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCommandType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["setpoint"]},{"dataType":"enum","enums":["update-version"]},{"dataType":"enum","enums":["restart-engine"]},{"dataType":"enum","enums":["regenerate-cipher-keys"]},{"dataType":"enum","enums":["update-engine-settings"]},{"dataType":"enum","enums":["update-registration-settings"]},{"dataType":"enum","enums":["create-scan-mode"]},{"dataType":"enum","enums":["update-scan-mode"]},{"dataType":"enum","enums":["delete-scan-mode"]},{"dataType":"enum","enums":["create-ip-filter"]},{"dataType":"enum","enums":["update-ip-filter"]},{"dataType":"enum","enums":["delete-ip-filter"]},{"dataType":"enum","enums":["create-certificate"]},{"dataType":"enum","enums":["update-certificate"]},{"dataType":"enum","enums":["delete-certificate"]},{"dataType":"enum","enums":["create-south"]},{"dataType":"enum","enums":["update-south"]},{"dataType":"enum","enums":["delete-south"]},{"dataType":"enum","enums":["test-south-connection"]},{"dataType":"enum","enums":["test-south-item"]},{"dataType":"enum","enums":["create-north"]},{"dataType":"enum","enums":["update-north"]},{"dataType":"enum","enums":["delete-north"]},{"dataType":"enum","enums":["test-north-connection"]},{"dataType":"enum","enums":["create-or-update-south-items-from-csv"]},{"dataType":"enum","enums":["create-history-query"]},{"dataType":"enum","enums":["update-history-query"]},{"dataType":"enum","enums":["delete-history-query"]},{"dataType":"enum","enums":["test-history-query-north-connection"]},{"dataType":"enum","enums":["test-history-query-south-connection"]},{"dataType":"enum","enums":["test-history-query-south-item"]},{"dataType":"enum","enums":["create-or-update-history-query-south-items-from-csv"]},{"dataType":"enum","enums":["update-history-query-status"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCommandStatus": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["RETRIEVED"]},{"dataType":"enum","enums":["RUNNING"]},{"dataType":"enum","enums":["ERRORED"]},{"dataType":"enum","enums":["CANCELLED"]},{"dataType":"enum","enums":["COMPLETED"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateVersionCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-version"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"backupFolders":{"dataType":"string","required":true},"updateLauncher":{"dataType":"boolean","required":true},"assetId":{"dataType":"string","required":true},"version":{"dataType":"string","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusRegenerateCipherKeysCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["regenerate-cipher-keys"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusRestartEngineCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["restart-engine"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LogLevel": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["silent"]},{"dataType":"enum","enums":["error"]},{"dataType":"enum","enums":["warn"]},{"dataType":"enum","enums":["info"]},{"dataType":"enum","enums":["debug"]},{"dataType":"enum","enums":["trace"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "EngineSettingsCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "proxyEnabled": {"dataType":"boolean","required":true},
            "proxyPort": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "logParameters": {"dataType":"nestedObjectLiteral","nestedProperties":{"oia":{"dataType":"nestedObjectLiteral","nestedProperties":{"interval":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"loki":{"dataType":"nestedObjectLiteral","nestedProperties":{"password":{"dataType":"string","required":true},"username":{"dataType":"string","required":true},"address":{"dataType":"string","required":true},"interval":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"database":{"dataType":"nestedObjectLiteral","nestedProperties":{"maxNumberOfLogs":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"file":{"dataType":"nestedObjectLiteral","nestedProperties":{"numberOfFiles":{"dataType":"double","required":true},"maxFileSize":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"console":{"dataType":"nestedObjectLiteral","nestedProperties":{"level":{"ref":"LogLevel","required":true}},"required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateEngineSettingsCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-engine-settings"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"EngineSettingsCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateRegistrationSettingsCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-registration-settings"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"messageRetryInterval":{"dataType":"double","required":true},"commandRetryInterval":{"dataType":"double","required":true},"commandRefreshInterval":{"dataType":"double","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateScanModeCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-scan-mode"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"ScanModeCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateScanModeCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-scan-mode"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "scanModeId": {"dataType":"string","required":true},
            "commandContent": {"ref":"ScanModeCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDeleteScanModeCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["delete-scan-mode"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "scanModeId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IPFilterCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "address": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateIPFilterCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-ip-filter"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"IPFilterCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateIPFilterCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-ip-filter"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "ipFilterId": {"dataType":"string","required":true},
            "commandContent": {"ref":"IPFilterCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDeleteIPFilterCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["delete-ip-filter"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "ipFilterId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CertificateOptions": {
        "dataType": "refObject",
        "properties": {
            "commonName": {"dataType":"string","required":true},
            "countryName": {"dataType":"string","required":true},
            "stateOrProvinceName": {"dataType":"string","required":true},
            "localityName": {"dataType":"string","required":true},
            "organizationName": {"dataType":"string","required":true},
            "keySize": {"dataType":"double","required":true},
            "daysBeforeExpiry": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CertificateCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "regenerateCertificate": {"dataType":"boolean","required":true},
            "options": {"dataType":"union","subSchemas":[{"ref":"CertificateOptions"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateCertificateCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-certificate"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"CertificateCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateCertificateCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-certificate"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "certificateId": {"dataType":"string","required":true},
            "commandContent": {"ref":"CertificateCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDeleteCertificateCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["delete-certificate"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "certificateId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateSouthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-south"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"SouthConnectorCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateSouthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-south"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"string","required":true},
            "commandContent": {"ref":"SouthConnectorCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDeleteSouthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["delete-south"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTestSouthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["test-south-connection"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTestSouthConnectorItemCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["test-south-item"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"string","required":true},
            "itemId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusNorthType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["modbus"]},{"dataType":"enum","enums":["mqtt"]},{"dataType":"enum","enums":["oianalytics"]},{"dataType":"enum","enums":["opcua"]},{"dataType":"enum","enums":["sftp"]},{"dataType":"enum","enums":["azure-blob"]},{"dataType":"enum","enums":["aws-s3"]},{"dataType":"enum","enums":["console"]},{"dataType":"enum","enums":["file-writer"]},{"dataType":"enum","enums":["rest"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthAmazonS3Settings": {
        "dataType": "refObject",
        "properties": {
            "bucket": {"dataType":"string","required":true},
            "region": {"dataType":"string","required":true},
            "folder": {"dataType":"string","required":true},
            "accessKey": {"dataType":"string","required":true},
            "secretKey": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "proxyUsername": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "proxyPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthAzureBlobSettingsAuthentication": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["access-key"]},{"dataType":"enum","enums":["sas-token"]},{"dataType":"enum","enums":["aad"]},{"dataType":"enum","enums":["external"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthAzureBlobSettings": {
        "dataType": "refObject",
        "properties": {
            "useADLS": {"dataType":"boolean","required":true},
            "useCustomUrl": {"dataType":"boolean","required":true},
            "account": {"dataType":"string"},
            "customUrl": {"dataType":"string"},
            "container": {"dataType":"string","required":true},
            "path": {"dataType":"string","required":true},
            "authentication": {"ref":"NorthAzureBlobSettingsAuthentication","required":true},
            "accessKey": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "sasToken": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "tenantId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "clientId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "clientSecret": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"string"},
            "proxyUsername": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "proxyPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthConsoleSettings": {
        "dataType": "refObject",
        "properties": {
            "verbose": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthFileWriterSettings": {
        "dataType": "refObject",
        "properties": {
            "outputFolder": {"dataType":"string","required":true},
            "prefix": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "suffix": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthModbusSettingsAddressOffset": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["modbus"]},{"dataType":"enum","enums":["jbus"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthModbusSettingsEndianness": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["big-endian"]},{"dataType":"enum","enums":["little-endian"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthModbusSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "slaveId": {"dataType":"double","required":true},
            "addressOffset": {"ref":"NorthModbusSettingsAddressOffset","required":true},
            "endianness": {"ref":"NorthModbusSettingsEndianness","required":true},
            "swapBytesInWords": {"dataType":"boolean","required":true},
            "swapWordsInDWords": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthMQTTSettingsQos": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["0"]},{"dataType":"enum","enums":["1"]},{"dataType":"enum","enums":["2"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthMQTTSettingsAuthenticationType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["cert"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthMQTTSettingsAuthentication": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"NorthMQTTSettingsAuthenticationType","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "certFilePath": {"dataType":"string"},
            "keyFilePath": {"dataType":"string"},
            "caFilePath": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthMQTTSettings": {
        "dataType": "refObject",
        "properties": {
            "url": {"dataType":"string","required":true},
            "qos": {"ref":"NorthMQTTSettingsQos","required":true},
            "persistent": {"dataType":"boolean"},
            "authentication": {"ref":"NorthMQTTSettingsAuthentication","required":true},
            "rejectUnauthorized": {"dataType":"boolean","required":true},
            "reconnectPeriod": {"dataType":"double","required":true},
            "connectTimeout": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOIAnalyticsSettingsSpecificSettingsAuthentication": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["aad-client-secret"]},{"dataType":"enum","enums":["aad-certificate"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOIAnalyticsSettingsSpecificSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "acceptUnauthorized": {"dataType":"boolean","required":true},
            "authentication": {"ref":"NorthOIAnalyticsSettingsSpecificSettingsAuthentication","required":true},
            "accessKey": {"dataType":"string"},
            "secretKey": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "tenantId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "clientId": {"dataType":"string"},
            "clientSecret": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "certificateId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "scope": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"string"},
            "proxyUsername": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "proxyPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOIAnalyticsSettings": {
        "dataType": "refObject",
        "properties": {
            "useOiaModule": {"dataType":"boolean","required":true},
            "timeout": {"dataType":"double","required":true},
            "compress": {"dataType":"boolean","required":true},
            "specificSettings": {"dataType":"union","subSchemas":[{"ref":"NorthOIAnalyticsSettingsSpecificSettings"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOPCUASettingsSecurityMode": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["sign"]},{"dataType":"enum","enums":["sign-and-encrypt"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOPCUASettingsSecurityPolicy": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["basic128"]},{"dataType":"enum","enums":["basic192"]},{"dataType":"enum","enums":["basic192-rsa15"]},{"dataType":"enum","enums":["basic256-rsa15"]},{"dataType":"enum","enums":["basic256-sha256"]},{"dataType":"enum","enums":["aes128-sha256-rsa-oaep"]},{"dataType":"enum","enums":["pub-sub-aes-128-ctr"]},{"dataType":"enum","enums":["pub-sub-aes-256-ctr"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOPCUASettingsAuthenticationType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["none"]},{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["cert"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOPCUASettingsAuthentication": {
        "dataType": "refObject",
        "properties": {
            "type": {"ref":"NorthOPCUASettingsAuthenticationType","required":true},
            "username": {"dataType":"string"},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "certFilePath": {"dataType":"string"},
            "keyFilePath": {"dataType":"string"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthOPCUASettings": {
        "dataType": "refObject",
        "properties": {
            "url": {"dataType":"string","required":true},
            "keepSessionAlive": {"dataType":"boolean","required":true},
            "retryInterval": {"dataType":"double","required":true},
            "securityMode": {"ref":"NorthOPCUASettingsSecurityMode","required":true},
            "securityPolicy": {"ref":"NorthOPCUASettingsSecurityPolicy"},
            "authentication": {"ref":"NorthOPCUASettingsAuthentication","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthRESTSettingsAuthType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["basic"]},{"dataType":"enum","enums":["bearer"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthRESTSettingsQueryParams": {
        "dataType": "refObject",
        "properties": {
            "key": {"dataType":"string","required":true},
            "value": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthRESTSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "acceptUnauthorized": {"dataType":"boolean","required":true},
            "endpoint": {"dataType":"string","required":true},
            "testPath": {"dataType":"string","required":true},
            "timeout": {"dataType":"double","required":true},
            "authType": {"ref":"NorthRESTSettingsAuthType","required":true},
            "bearerAuthToken": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "basicAuthUsername": {"dataType":"string"},
            "basicAuthPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "queryParams": {"dataType":"union","subSchemas":[{"dataType":"array","array":{"dataType":"refObject","ref":"NorthRESTSettingsQueryParams"}},{"dataType":"enum","enums":[null]}],"required":true},
            "useProxy": {"dataType":"boolean","required":true},
            "proxyUrl": {"dataType":"string"},
            "proxyUsername": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "proxyPassword": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthSFTPSettingsAuthentication": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["password"]},{"dataType":"enum","enums":["private-key"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthSFTPSettings": {
        "dataType": "refObject",
        "properties": {
            "host": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "authentication": {"ref":"NorthSFTPSettingsAuthentication","required":true},
            "username": {"dataType":"string","required":true},
            "password": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "privateKey": {"dataType":"string"},
            "passphrase": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}]},
            "remoteFolder": {"dataType":"string","required":true},
            "prefix": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "suffix": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthSettings": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"NorthAmazonS3Settings"},{"ref":"NorthAzureBlobSettings"},{"ref":"NorthConsoleSettings"},{"ref":"NorthFileWriterSettings"},{"ref":"NorthModbusSettings"},{"ref":"NorthMQTTSettings"},{"ref":"NorthOIAnalyticsSettings"},{"ref":"NorthOPCUASettings"},{"ref":"NorthRESTSettings"},{"ref":"NorthSFTPSettings"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_string.unknown_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"any"},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TransformerIdWithOptions": {
        "dataType": "refObject",
        "properties": {
            "inputType": {"dataType":"string","required":true},
            "transformerId": {"dataType":"string","required":true},
            "options": {"ref":"Record_string.unknown_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "type": {"ref":"OIBusNorthType","required":true},
            "description": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"NorthSettings","required":true},
            "caching": {"dataType":"nestedObjectLiteral","nestedProperties":{"archive":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"enabled":{"dataType":"boolean","required":true}},"required":true},"error":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"retryCount":{"dataType":"double","required":true},"retryInterval":{"dataType":"double","required":true}},"required":true},"throttling":{"dataType":"nestedObjectLiteral","nestedProperties":{"maxNumberOfElements":{"dataType":"double","required":true},"maxSize":{"dataType":"double","required":true},"runMinDelay":{"dataType":"double","required":true}},"required":true},"trigger":{"dataType":"nestedObjectLiteral","nestedProperties":{"numberOfFiles":{"dataType":"double","required":true},"numberOfElements":{"dataType":"double","required":true},"scanModeName":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},"scanModeId":{"dataType":"string","required":true}},"required":true}},"required":true},
            "subscriptions": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "transformers": {"dataType":"array","array":{"dataType":"refObject","ref":"TransformerIdWithOptions"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateNorthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-north"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"NorthConnectorCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateNorthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-north"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "northConnectorId": {"dataType":"string","required":true},
            "commandContent": {"ref":"NorthConnectorCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDeleteNorthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["delete-north"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "northConnectorId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTestNorthConnectorCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["test-north-connection"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "northConnectorId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-or-update-south-items-from-csv"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"string","required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"delimiter":{"dataType":"string","required":true},"csvContent":{"dataType":"string","required":true},"deleteItemsNotPresent":{"dataType":"boolean","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryQueryItemCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "name": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"SouthItemSettings","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryQueryCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "startTime": {"dataType":"string","required":true},
            "endTime": {"dataType":"string","required":true},
            "southType": {"ref":"OIBusSouthType","required":true},
            "northType": {"ref":"OIBusNorthType","required":true},
            "southSettings": {"ref":"SouthSettings","required":true},
            "northSettings": {"ref":"NorthSettings","required":true},
            "caching": {"dataType":"nestedObjectLiteral","nestedProperties":{"archive":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"enabled":{"dataType":"boolean","required":true}},"required":true},"error":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"retryCount":{"dataType":"double","required":true},"retryInterval":{"dataType":"double","required":true}},"required":true},"throttling":{"dataType":"nestedObjectLiteral","nestedProperties":{"maxNumberOfElements":{"dataType":"double","required":true},"maxSize":{"dataType":"double","required":true},"runMinDelay":{"dataType":"double","required":true}},"required":true},"trigger":{"dataType":"nestedObjectLiteral","nestedProperties":{"numberOfFiles":{"dataType":"double","required":true},"numberOfElements":{"dataType":"double","required":true},"scanModeName":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},"scanModeId":{"dataType":"string","required":true}},"required":true}},"required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"HistoryQueryItemCommandDTO"},"required":true},
            "northTransformers": {"dataType":"array","array":{"dataType":"refObject","ref":"TransformerIdWithOptions"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateHistoryQueryCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-history-query"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "commandContent": {"ref":"HistoryQueryCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateHistoryQueryCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-history-query"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"historyQuery":{"ref":"HistoryQueryCommandDTO","required":true},"resetCache":{"dataType":"boolean","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusDeleteHistoryQueryCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["delete-history-query"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTestHistoryQueryNorthConnectionCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["test-history-query-north-connection"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
            "northConnectorId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}],"required":true},
            "commandContent": {"ref":"HistoryQueryCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTestHistoryQuerySouthConnectionCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["test-history-query-south-connection"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}],"required":true},
            "commandContent": {"ref":"HistoryQueryCommandDTO","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusTestHistoryQuerySouthItemCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["test-history-query-south-item"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
            "southConnectorId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}],"required":true},
            "itemId": {"dataType":"string","required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"testingSettings":{"ref":"SouthConnectorItemTestingSettings","required":true},"itemCommand":{"ref":"HistoryQueryItemCommandDTO","required":true},"historyCommand":{"ref":"HistoryQueryCommandDTO","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["create-or-update-history-query-south-items-from-csv"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"delimiter":{"dataType":"string","required":true},"csvContent":{"dataType":"string","required":true},"deleteItemsNotPresent":{"dataType":"boolean","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryQueryStatus": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["PENDING"]},{"dataType":"enum","enums":["RUNNING"]},{"dataType":"enum","enums":["ERRORED"]},{"dataType":"enum","enums":["PAUSED"]},{"dataType":"enum","enums":["FINISHED"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusUpdateHistoryQueryStatusCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["update-history-query-status"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "historyQueryId": {"dataType":"string","required":true},
            "commandContent": {"dataType":"nestedObjectLiteral","nestedProperties":{"historyQueryStatus":{"ref":"HistoryQueryStatus","required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusSetpointCommandDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "type": {"dataType":"enum","enums":["setpoint"],"required":true},
            "status": {"ref":"OIBusCommandStatus","required":true},
            "ack": {"dataType":"boolean","required":true},
            "retrievedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "completedDate": {"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"enum","enums":[null]}],"required":true},
            "result": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "targetVersion": {"dataType":"string","required":true},
            "northConnectorId": {"dataType":"string","required":true},
            "commandContent": {"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"value":{"dataType":"string","required":true},"reference":{"dataType":"string","required":true}}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusCommandDTO": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"ref":"OIBusUpdateVersionCommandDTO"},{"ref":"OIBusRegenerateCipherKeysCommandDTO"},{"ref":"OIBusRestartEngineCommandDTO"},{"ref":"OIBusUpdateEngineSettingsCommandDTO"},{"ref":"OIBusUpdateRegistrationSettingsCommandDTO"},{"ref":"OIBusCreateScanModeCommandDTO"},{"ref":"OIBusUpdateScanModeCommandDTO"},{"ref":"OIBusDeleteScanModeCommandDTO"},{"ref":"OIBusCreateIPFilterCommandDTO"},{"ref":"OIBusUpdateIPFilterCommandDTO"},{"ref":"OIBusDeleteIPFilterCommandDTO"},{"ref":"OIBusCreateCertificateCommandDTO"},{"ref":"OIBusUpdateCertificateCommandDTO"},{"ref":"OIBusDeleteCertificateCommandDTO"},{"ref":"OIBusCreateSouthConnectorCommandDTO"},{"ref":"OIBusUpdateSouthConnectorCommandDTO"},{"ref":"OIBusDeleteSouthConnectorCommandDTO"},{"ref":"OIBusTestSouthConnectorCommandDTO"},{"ref":"OIBusTestSouthConnectorItemCommandDTO"},{"ref":"OIBusCreateNorthConnectorCommandDTO"},{"ref":"OIBusUpdateNorthConnectorCommandDTO"},{"ref":"OIBusDeleteNorthConnectorCommandDTO"},{"ref":"OIBusTestNorthConnectorCommandDTO"},{"ref":"OIBusCreateOrUpdateSouthConnectorItemsFromCSVCommandDTO"},{"ref":"OIBusCreateHistoryQueryCommandDTO"},{"ref":"OIBusUpdateHistoryQueryCommandDTO"},{"ref":"OIBusDeleteHistoryQueryCommandDTO"},{"ref":"OIBusTestHistoryQueryNorthConnectionCommandDTO"},{"ref":"OIBusTestHistoryQuerySouthConnectionCommandDTO"},{"ref":"OIBusTestHistoryQuerySouthItemCommandDTO"},{"ref":"OIBusCreateOrUpdateHistoryQuerySouthItemsFromCSVCommandDTO"},{"ref":"OIBusUpdateHistoryQueryStatusCommandDTO"},{"ref":"OIBusSetpointCommandDTO"}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Page_OIBusCommandDTO_": {
        "dataType": "refObject",
        "properties": {
            "content": {"dataType":"array","array":{"dataType":"refAlias","ref":"OIBusCommandDTO"},"required":true},
            "totalElements": {"dataType":"double","required":true},
            "size": {"dataType":"double","required":true},
            "number": {"dataType":"double","required":true},
            "totalPages": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusNorthCategory": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["file"]},{"dataType":"enum","enums":["iot"]},{"dataType":"enum","enums":["api"]},{"dataType":"enum","enums":["debug"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthConnectorType": {
        "dataType": "refObject",
        "properties": {
            "id": {"ref":"OIBusNorthType","required":true},
            "category": {"ref":"OIBusNorthCategory","required":true},
            "types": {"dataType":"array","array":{"dataType":"string"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthConnectorManifest": {
        "dataType": "refObject",
        "properties": {
            "id": {"ref":"OIBusNorthType","required":true},
            "category": {"ref":"OIBusNorthCategory","required":true},
            "types": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "settings": {"ref":"OIBusObjectAttribute","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthConnectorLightDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "type": {"ref":"OIBusNorthType","required":true},
            "description": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "TransformerDTOWithOptions": {
        "dataType": "refObject",
        "properties": {
            "inputType": {"dataType":"string","required":true},
            "transformer": {"ref":"TransformerDTO","required":true},
            "options": {"ref":"Record_string.unknown_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthConnectorDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "type": {"ref":"OIBusNorthType","required":true},
            "description": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"NorthSettings","required":true},
            "caching": {"dataType":"nestedObjectLiteral","nestedProperties":{"archive":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"enabled":{"dataType":"boolean","required":true}},"required":true},"error":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"retryCount":{"dataType":"double","required":true},"retryInterval":{"dataType":"double","required":true}},"required":true},"throttling":{"dataType":"nestedObjectLiteral","nestedProperties":{"maxNumberOfElements":{"dataType":"double","required":true},"maxSize":{"dataType":"double","required":true},"runMinDelay":{"dataType":"double","required":true}},"required":true},"trigger":{"dataType":"nestedObjectLiteral","nestedProperties":{"numberOfFiles":{"dataType":"double","required":true},"numberOfElements":{"dataType":"double","required":true},"scanMode":{"ref":"ScanModeDTO","required":true}},"required":true}},"required":true},
            "subscriptions": {"dataType":"array","array":{"dataType":"refObject","ref":"SouthConnectorLightDTO"},"required":true},
            "transformers": {"dataType":"array","array":{"dataType":"refObject","ref":"TransformerDTOWithOptions"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Record_string.string-or-number_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{},"additionalProperties":{"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"double"}]},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CacheMetadata": {
        "dataType": "refObject",
        "properties": {
            "contentFile": {"dataType":"string","required":true},
            "contentSize": {"dataType":"double","required":true},
            "numberOfElement": {"dataType":"double","required":true},
            "createdAt": {"ref":"Instant","required":true},
            "contentType": {"dataType":"string","required":true},
            "source": {"dataType":"string","required":true},
            "options": {"ref":"Record_string.string-or-number_","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "NorthCacheMetadata": {
        "dataType": "refObject",
        "properties": {
            "metadataFilename": {"dataType":"string","required":true},
            "metadata": {"ref":"CacheMetadata","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ScopeType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["south"]},{"dataType":"enum","enums":["north"]},{"dataType":"enum","enums":["history-query"]},{"dataType":"enum","enums":["internal"]},{"dataType":"enum","enums":["web-server"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "LogDTO": {
        "dataType": "refObject",
        "properties": {
            "timestamp": {"dataType":"string","required":true},
            "level": {"ref":"LogLevel","required":true},
            "scopeType": {"ref":"ScopeType","required":true},
            "scopeId": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "scopeName": {"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"enum","enums":[null]}],"required":true},
            "message": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Page_LogDTO_": {
        "dataType": "refObject",
        "properties": {
            "content": {"dataType":"array","array":{"dataType":"refObject","ref":"LogDTO"},"required":true},
            "totalElements": {"dataType":"double","required":true},
            "size": {"dataType":"double","required":true},
            "number": {"dataType":"double","required":true},
            "totalPages": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Scope": {
        "dataType": "refObject",
        "properties": {
            "scopeId": {"dataType":"string","required":true},
            "scopeName": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "IPFilterDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "address": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryQueryLightDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "status": {"ref":"HistoryQueryStatus","required":true},
            "startTime": {"dataType":"string","required":true},
            "endTime": {"dataType":"string","required":true},
            "southType": {"ref":"OIBusSouthType","required":true},
            "northType": {"ref":"OIBusNorthType","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryQueryItemDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "enabled": {"dataType":"boolean","required":true},
            "settings": {"ref":"SouthItemSettings","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryQueryDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "status": {"ref":"HistoryQueryStatus","required":true},
            "startTime": {"dataType":"string","required":true},
            "endTime": {"dataType":"string","required":true},
            "southType": {"ref":"OIBusSouthType","required":true},
            "northType": {"ref":"OIBusNorthType","required":true},
            "southSettings": {"ref":"SouthSettings","required":true},
            "northSettings": {"ref":"NorthSettings","required":true},
            "caching": {"dataType":"nestedObjectLiteral","nestedProperties":{"archive":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"enabled":{"dataType":"boolean","required":true}},"required":true},"error":{"dataType":"nestedObjectLiteral","nestedProperties":{"retentionDuration":{"dataType":"double","required":true},"retryCount":{"dataType":"double","required":true},"retryInterval":{"dataType":"double","required":true}},"required":true},"throttling":{"dataType":"nestedObjectLiteral","nestedProperties":{"maxNumberOfElements":{"dataType":"double","required":true},"maxSize":{"dataType":"double","required":true},"runMinDelay":{"dataType":"double","required":true}},"required":true},"trigger":{"dataType":"nestedObjectLiteral","nestedProperties":{"numberOfFiles":{"dataType":"double","required":true},"numberOfElements":{"dataType":"double","required":true},"scanMode":{"ref":"ScanModeDTO","required":true}},"required":true}},"required":true},
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"HistoryQueryItemDTO"},"required":true},
            "northTransformers": {"dataType":"array","array":{"dataType":"refObject","ref":"TransformerDTOWithOptions"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistorySouthItemTestRequest": {
        "dataType": "refObject",
        "properties": {
            "southSettings": {"ref":"SouthSettings","required":true},
            "itemSettings": {"ref":"SouthItemSettings","required":true},
            "testingSettings": {"dataType":"nestedObjectLiteral","nestedProperties":{"history":{"dataType":"nestedObjectLiteral","nestedProperties":{"endTime":{"dataType":"string","required":true},"startTime":{"dataType":"string","required":true}},"required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Page_HistoryQueryItemDTO_": {
        "dataType": "refObject",
        "properties": {
            "content": {"dataType":"array","array":{"dataType":"refObject","ref":"HistoryQueryItemDTO"},"required":true},
            "totalElements": {"dataType":"double","required":true},
            "size": {"dataType":"double","required":true},
            "number": {"dataType":"double","required":true},
            "totalPages": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryCsvDelimiterRequest": {
        "dataType": "refObject",
        "properties": {
            "delimiter": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryCsvImportResponse": {
        "dataType": "refObject",
        "properties": {
            "items": {"dataType":"array","array":{"dataType":"refObject","ref":"HistoryQueryItemCommandDTO"},"required":true},
            "errors": {"dataType":"array","array":{"dataType":"nestedObjectLiteral","nestedProperties":{"error":{"dataType":"string","required":true},"item":{"ref":"Record_string.string_","required":true}}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HistoryCacheMetadata": {
        "dataType": "refObject",
        "properties": {
            "metadataFilename": {"dataType":"string","required":true},
            "metadata": {"ref":"CacheMetadata","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "EngineSettingsDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "port": {"dataType":"double","required":true},
            "version": {"dataType":"string","required":true},
            "launcherVersion": {"dataType":"string","required":true},
            "proxyEnabled": {"dataType":"boolean","required":true},
            "proxyPort": {"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"enum","enums":[null]}],"required":true},
            "logParameters": {"dataType":"nestedObjectLiteral","nestedProperties":{"oia":{"dataType":"nestedObjectLiteral","nestedProperties":{"interval":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"loki":{"dataType":"nestedObjectLiteral","nestedProperties":{"password":{"dataType":"string","required":true},"username":{"dataType":"string","required":true},"address":{"dataType":"string","required":true},"interval":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"database":{"dataType":"nestedObjectLiteral","nestedProperties":{"maxNumberOfLogs":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"file":{"dataType":"nestedObjectLiteral","nestedProperties":{"numberOfFiles":{"dataType":"double","required":true},"maxFileSize":{"dataType":"double","required":true},"level":{"ref":"LogLevel","required":true}},"required":true},"console":{"dataType":"nestedObjectLiteral","nestedProperties":{"level":{"ref":"LogLevel","required":true}},"required":true}},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "OIBusInfo": {
        "dataType": "refObject",
        "properties": {
            "version": {"dataType":"string","required":true},
            "launcherVersion": {"dataType":"string","required":true},
            "oibusName": {"dataType":"string","required":true},
            "oibusId": {"dataType":"string","required":true},
            "dataDirectory": {"dataType":"string","required":true},
            "binaryDirectory": {"dataType":"string","required":true},
            "processId": {"dataType":"string","required":true},
            "hostname": {"dataType":"string","required":true},
            "operatingSystem": {"dataType":"string","required":true},
            "architecture": {"dataType":"string","required":true},
            "platform": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CertificateDTO": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "creationDate": {"ref":"Instant"},
            "lastEditInstant": {"ref":"Instant"},
            "name": {"dataType":"string","required":true},
            "description": {"dataType":"string","required":true},
            "publicKey": {"dataType":"string","required":true},
            "certificate": {"dataType":"string","required":true},
            "expiry": {"ref":"Instant","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new ExpressTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa




export function RegisterRoutes(app: Router,opts?:{multer?:ReturnType<typeof multer>}) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################

    const upload = opts?.multer ||  multer({"limits":{"fileSize":8388608}});

    
        const argsUserController_search: Record<string, TsoaRoute.ParameterSchema> = {
                login: {"in":"query","name":"login","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                page: {"in":"query","name":"page","required":true,"dataType":"union","subSchemas":[{"dataType":"double"},{"dataType":"undefined"}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/users',
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.search)),

            async function UserController_search(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_search, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'search',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                userId: {"in":"path","name":"userId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/users/:userId',
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.findById)),

            async function UserController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_findById, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"UserWithPassword"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/users',
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.create)),

            async function UserController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_create, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_update: Record<string, TsoaRoute.ParameterSchema> = {
                userId: {"in":"path","name":"userId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"UserCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/users/:userId',
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.update)),

            async function UserController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_update, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_updatePassword: Record<string, TsoaRoute.ParameterSchema> = {
                userId: {"in":"path","name":"userId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"ChangePasswordCommand"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/users/:userId/password',
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.updatePassword)),

            async function UserController_updatePassword(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_updatePassword, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'updatePassword',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                userId: {"in":"path","name":"userId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/users/:userId',
            ...(fetchMiddlewares<RequestHandler>(UserController)),
            ...(fetchMiddlewares<RequestHandler>(UserController.prototype.delete)),

            async function UserController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsUserController_delete, request, response });

                const controller = new UserController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsTransformerController_search: Record<string, TsoaRoute.ParameterSchema> = {
                type: {"in":"query","name":"type","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["standard"]},{"dataType":"enum","enums":["custom"]},{"dataType":"undefined"}]},
                inputType: {"in":"query","name":"inputType","required":true,"dataType":"union","subSchemas":[{"ref":"OIBusDataType"},{"dataType":"undefined"}]},
                outputType: {"in":"query","name":"outputType","required":true,"dataType":"union","subSchemas":[{"ref":"OIBusDataType"},{"dataType":"undefined"}]},
                page: {"default":0,"in":"query","name":"page","dataType":"double"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/transformers/search',
            ...(fetchMiddlewares<RequestHandler>(TransformerController)),
            ...(fetchMiddlewares<RequestHandler>(TransformerController.prototype.search)),

            async function TransformerController_search(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsTransformerController_search, request, response });

                const controller = new TransformerController();

              await templateService.apiHandler({
                methodName: 'search',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsTransformerController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/transformers/list',
            ...(fetchMiddlewares<RequestHandler>(TransformerController)),
            ...(fetchMiddlewares<RequestHandler>(TransformerController.prototype.list)),

            async function TransformerController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsTransformerController_list, request, response });

                const controller = new TransformerController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsTransformerController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                transformerId: {"in":"path","name":"transformerId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/transformers/:transformerId',
            ...(fetchMiddlewares<RequestHandler>(TransformerController)),
            ...(fetchMiddlewares<RequestHandler>(TransformerController.prototype.findById)),

            async function TransformerController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsTransformerController_findById, request, response });

                const controller = new TransformerController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsTransformerController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"CustomTransformerCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/transformers',
            ...(fetchMiddlewares<RequestHandler>(TransformerController)),
            ...(fetchMiddlewares<RequestHandler>(TransformerController.prototype.create)),

            async function TransformerController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsTransformerController_create, request, response });

                const controller = new TransformerController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsTransformerController_update: Record<string, TsoaRoute.ParameterSchema> = {
                transformerId: {"in":"path","name":"transformerId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"CustomTransformerCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/transformers/:transformerId',
            ...(fetchMiddlewares<RequestHandler>(TransformerController)),
            ...(fetchMiddlewares<RequestHandler>(TransformerController.prototype.update)),

            async function TransformerController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsTransformerController_update, request, response });

                const controller = new TransformerController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsTransformerController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                transformerId: {"in":"path","name":"transformerId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/transformers/:transformerId',
            ...(fetchMiddlewares<RequestHandler>(TransformerController)),
            ...(fetchMiddlewares<RequestHandler>(TransformerController.prototype.delete)),

            async function TransformerController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsTransformerController_delete, request, response });

                const controller = new TransformerController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_listManifest: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south/types',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.listManifest)),

            async function SouthConnectorController_listManifest(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_listManifest, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'listManifest',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_getManifest: Record<string, TsoaRoute.ParameterSchema> = {
                type: {"in":"path","name":"type","required":true,"ref":"OIBusSouthType"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south/manifests/:type',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.getManifest)),

            async function SouthConnectorController_getManifest(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_getManifest, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'getManifest',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.list)),

            async function SouthConnectorController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_list, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south/:southId',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.findById)),

            async function SouthConnectorController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_findById, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"SouthConnectorCommandDTO"},
                duplicate: {"in":"query","name":"duplicate","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.create)),

            async function SouthConnectorController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_create, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_update: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"SouthConnectorCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/south/:southId',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.update)),

            async function SouthConnectorController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_update, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/south/:southId',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.delete)),

            async function SouthConnectorController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_delete, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_start: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/start',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.start)),

            async function SouthConnectorController_start(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_start, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'start',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_stop: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/stop',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.stop)),

            async function SouthConnectorController_stop(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_stop, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'stop',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_resetSouthMetrics: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/metrics/reset',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.resetSouthMetrics)),

            async function SouthConnectorController_resetSouthMetrics(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_resetSouthMetrics, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'resetSouthMetrics',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_testConnection: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                southType: {"in":"query","name":"southType","required":true,"ref":"OIBusSouthType"},
                command: {"in":"body","name":"command","required":true,"ref":"SouthSettings"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/test/connection',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.testConnection)),

            async function SouthConnectorController_testConnection(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_testConnection, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'testConnection',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_testItem: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                southType: {"in":"query","name":"southType","required":true,"ref":"OIBusSouthType"},
                itemName: {"in":"query","name":"itemName","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"SouthItemTestRequest"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/test',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.testItem)),

            async function SouthConnectorController_testItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_testItem, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'testItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_listItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south/:southId/items/list',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.listItems)),

            async function SouthConnectorController_listItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_listItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'listItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_searchItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                name: {"in":"query","name":"name","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                scanModeId: {"in":"query","name":"scanModeId","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                enabled: {"in":"query","name":"enabled","required":true,"dataType":"union","subSchemas":[{"dataType":"boolean"},{"dataType":"undefined"}]},
                page: {"default":0,"in":"query","name":"page","dataType":"double"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south/:southId/items/search',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.searchItems)),

            async function SouthConnectorController_searchItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_searchItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'searchItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_findItemById: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/south/:southId/items/:itemId',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.findItemById)),

            async function SouthConnectorController_findItemById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_findItemById, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'findItemById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_createItem: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"SouthConnectorItemCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.createItem)),

            async function SouthConnectorController_createItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_createItem, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'createItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_updateItem: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"SouthConnectorItemCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/south/:southId/items/:itemId',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.updateItem)),

            async function SouthConnectorController_updateItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_updateItem, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'updateItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_enableItem: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/:itemId/enable',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.enableItem)),

            async function SouthConnectorController_enableItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_enableItem, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'enableItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_disableItem: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/:itemId/disable',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.disableItem)),

            async function SouthConnectorController_disableItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_disableItem, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'disableItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_enableItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"itemIds":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/enable',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.enableItems)),

            async function SouthConnectorController_enableItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_enableItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'enableItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_disableItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"itemIds":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/disable',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.disableItems)),

            async function SouthConnectorController_disableItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_disableItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'disableItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_deleteItem: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/south/:southId/items/:itemId',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.deleteItem)),

            async function SouthConnectorController_deleteItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_deleteItem, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'deleteItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_deleteItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"itemIds":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/delete',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.deleteItems)),

            async function SouthConnectorController_deleteItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_deleteItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'deleteItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_deleteAllItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/south/:southId/items',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.deleteAllItems)),

            async function SouthConnectorController_deleteAllItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_deleteAllItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'deleteAllItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_itemsToCsv: Record<string, TsoaRoute.ParameterSchema> = {
                southType: {"in":"path","name":"southType","required":true,"dataType":"string"},
                delimiter: {"in":"formData","name":"delimiter","required":true,"dataType":"string"},
                itemsFile: {"in":"formData","name":"items","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southType/items/to-csv',
            upload.fields([
                {
                    name: "items",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.itemsToCsv)),

            async function SouthConnectorController_itemsToCsv(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_itemsToCsv, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'itemsToCsv',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_exportItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"SouthCsvDelimiterRequest"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/export',
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.exportItems)),

            async function SouthConnectorController_exportItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_exportItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'exportItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_checkImportItems: Record<string, TsoaRoute.ParameterSchema> = {
                southType: {"in":"path","name":"southType","required":true,"dataType":"string"},
                delimiter: {"in":"formData","name":"delimiter","required":true,"dataType":"string"},
                itemsToImportFile: {"in":"formData","name":"itemsToImport","required":true,"dataType":"file"},
                currentItemsFile: {"in":"formData","name":"currentItems","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southType/items/import/check',
            upload.fields([
                {
                    name: "itemsToImport",
                    maxCount: 1
                },
                {
                    name: "currentItems",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.checkImportItems)),

            async function SouthConnectorController_checkImportItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_checkImportItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'checkImportItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsSouthConnectorController_importItems: Record<string, TsoaRoute.ParameterSchema> = {
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                itemsFile: {"in":"formData","name":"items","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/south/:southId/items/import',
            upload.fields([
                {
                    name: "items",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(SouthConnectorController.prototype.importItems)),

            async function SouthConnectorController_importItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsSouthConnectorController_importItems, request, response });

                const controller = new SouthConnectorController();

              await templateService.apiHandler({
                methodName: 'importItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsScanModeController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/scan-modes',
            ...(fetchMiddlewares<RequestHandler>(ScanModeController)),
            ...(fetchMiddlewares<RequestHandler>(ScanModeController.prototype.list)),

            async function ScanModeController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsScanModeController_list, request, response });

                const controller = new ScanModeController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsScanModeController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                scanModeId: {"in":"path","name":"scanModeId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/scan-modes/:scanModeId',
            ...(fetchMiddlewares<RequestHandler>(ScanModeController)),
            ...(fetchMiddlewares<RequestHandler>(ScanModeController.prototype.findById)),

            async function ScanModeController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsScanModeController_findById, request, response });

                const controller = new ScanModeController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsScanModeController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"ScanModeCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/scan-modes',
            ...(fetchMiddlewares<RequestHandler>(ScanModeController)),
            ...(fetchMiddlewares<RequestHandler>(ScanModeController.prototype.create)),

            async function ScanModeController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsScanModeController_create, request, response });

                const controller = new ScanModeController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsScanModeController_update: Record<string, TsoaRoute.ParameterSchema> = {
                scanModeId: {"in":"path","name":"scanModeId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"ScanModeCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/scan-modes/:scanModeId',
            ...(fetchMiddlewares<RequestHandler>(ScanModeController)),
            ...(fetchMiddlewares<RequestHandler>(ScanModeController.prototype.update)),

            async function ScanModeController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsScanModeController_update, request, response });

                const controller = new ScanModeController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsScanModeController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                scanModeId: {"in":"path","name":"scanModeId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/scan-modes/:scanModeId',
            ...(fetchMiddlewares<RequestHandler>(ScanModeController)),
            ...(fetchMiddlewares<RequestHandler>(ScanModeController.prototype.delete)),

            async function ScanModeController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsScanModeController_delete, request, response });

                const controller = new ScanModeController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsScanModeController_verifyCron: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"cron":{"dataType":"string","required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/scan-modes/verify',
            ...(fetchMiddlewares<RequestHandler>(ScanModeController)),
            ...(fetchMiddlewares<RequestHandler>(ScanModeController.prototype.verifyCron)),

            async function ScanModeController_verifyCron(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsScanModeController_verifyCron, request, response });

                const controller = new ScanModeController();

              await templateService.apiHandler({
                methodName: 'verifyCron',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOIAnalyticsRegistrationController_getRegistrationSettings: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/oianalytics/registration',
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController)),
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController.prototype.getRegistrationSettings)),

            async function OIAnalyticsRegistrationController_getRegistrationSettings(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOIAnalyticsRegistrationController_getRegistrationSettings, request, response });

                const controller = new OIAnalyticsRegistrationController();

              await templateService.apiHandler({
                methodName: 'getRegistrationSettings',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOIAnalyticsRegistrationController_register: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"RegistrationSettingsCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/oianalytics/register',
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController)),
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController.prototype.register)),

            async function OIAnalyticsRegistrationController_register(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOIAnalyticsRegistrationController_register, request, response });

                const controller = new OIAnalyticsRegistrationController();

              await templateService.apiHandler({
                methodName: 'register',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOIAnalyticsRegistrationController_editRegistrationSettings: Record<string, TsoaRoute.ParameterSchema> = {
                requestBody: {"in":"body","name":"requestBody","required":true,"ref":"RegistrationSettingsCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/oianalytics/registration',
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController)),
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController.prototype.editRegistrationSettings)),

            async function OIAnalyticsRegistrationController_editRegistrationSettings(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOIAnalyticsRegistrationController_editRegistrationSettings, request, response });

                const controller = new OIAnalyticsRegistrationController();

              await templateService.apiHandler({
                methodName: 'editRegistrationSettings',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOIAnalyticsRegistrationController_unregister: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/oianalytics/unregister',
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController)),
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsRegistrationController.prototype.unregister)),

            async function OIAnalyticsRegistrationController_unregister(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOIAnalyticsRegistrationController_unregister, request, response });

                const controller = new OIAnalyticsRegistrationController();

              await templateService.apiHandler({
                methodName: 'unregister',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOIAnalyticsCommandController_search: Record<string, TsoaRoute.ParameterSchema> = {
                types: {"in":"query","name":"types","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                status: {"in":"query","name":"status","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                start: {"in":"query","name":"start","required":true,"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"undefined"}]},
                end: {"in":"query","name":"end","required":true,"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"undefined"}]},
                ack: {"in":"query","name":"ack","required":true,"dataType":"union","subSchemas":[{"dataType":"boolean"},{"dataType":"undefined"}]},
                page: {"default":0,"in":"query","name":"page","dataType":"double"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/oianalytics/commands/search',
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsCommandController)),
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsCommandController.prototype.search)),

            async function OIAnalyticsCommandController_search(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOIAnalyticsCommandController_search, request, response });

                const controller = new OIAnalyticsCommandController();

              await templateService.apiHandler({
                methodName: 'search',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsOIAnalyticsCommandController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                commandId: {"in":"path","name":"commandId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/oianalytics/commands/:commandId',
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsCommandController)),
            ...(fetchMiddlewares<RequestHandler>(OIAnalyticsCommandController.prototype.delete)),

            async function OIAnalyticsCommandController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsOIAnalyticsCommandController_delete, request, response });

                const controller = new OIAnalyticsCommandController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_listManifest: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/north/types',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.listManifest)),

            async function NorthConnectorController_listManifest(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_listManifest, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'listManifest',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_getManifest: Record<string, TsoaRoute.ParameterSchema> = {
                type: {"in":"path","name":"type","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/north/manifests/:type',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.getManifest)),

            async function NorthConnectorController_getManifest(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_getManifest, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'getManifest',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/north',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.list)),

            async function NorthConnectorController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_list, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/north/:northId',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.findById)),

            async function NorthConnectorController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_findById, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"NorthConnectorCommandDTO"},
                duplicate: {"in":"query","name":"duplicate","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.create)),

            async function NorthConnectorController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_create, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_update: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"NorthConnectorCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/north/:northId',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.update)),

            async function NorthConnectorController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_update, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/north/:northId',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.delete)),

            async function NorthConnectorController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_delete, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_start: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/start',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.start)),

            async function NorthConnectorController_start(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_start, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'start',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_stop: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/stop',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.stop)),

            async function NorthConnectorController_stop(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_stop, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'stop',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_resetMetrics: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/metrics/reset',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.resetMetrics)),

            async function NorthConnectorController_resetMetrics(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_resetMetrics, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'resetMetrics',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_testNorth: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                northType: {"in":"query","name":"northType","required":true,"ref":"OIBusNorthType"},
                command: {"in":"body","name":"command","required":true,"ref":"NorthSettings"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/test/connection',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.testNorth)),

            async function NorthConnectorController_testNorth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_testNorth, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'testNorth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_addOrEditTransformer: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"TransformerDTOWithOptions"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/transformers',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.addOrEditTransformer)),

            async function NorthConnectorController_addOrEditTransformer(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_addOrEditTransformer, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'addOrEditTransformer',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_removeTransformer: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                transformerId: {"in":"path","name":"transformerId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/north/:northId/transformers/:transformerId',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.removeTransformer)),

            async function NorthConnectorController_removeTransformer(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_removeTransformer, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'removeTransformer',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_subscribeToSouth: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/subscriptions/:southId',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.subscribeToSouth)),

            async function NorthConnectorController_subscribeToSouth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_subscribeToSouth, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'subscribeToSouth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_unsubscribeFromSouth: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                southId: {"in":"path","name":"southId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/north/:northId/subscriptions/:southId',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.unsubscribeFromSouth)),

            async function NorthConnectorController_unsubscribeFromSouth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_unsubscribeFromSouth, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'unsubscribeFromSouth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_searchCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                nameContains: {"in":"query","name":"nameContains","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                start: {"in":"query","name":"start","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                end: {"in":"query","name":"end","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/north/:northId/cache/search',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.searchCacheContent)),

            async function NorthConnectorController_searchCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_searchCacheContent, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'searchCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_getCacheFileContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                filename: {"in":"path","name":"filename","required":true,"dataType":"string"},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/north/:northId/cache/content/:filename',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.getCacheFileContent)),

            async function NorthConnectorController_getCacheFileContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_getCacheFileContent, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'getCacheFileContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_removeCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                filenames: {"in":"body","name":"filenames","required":true,"dataType":"array","array":{"dataType":"string"}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/north/:northId/cache/remove',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.removeCacheContent)),

            async function NorthConnectorController_removeCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_removeCacheContent, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'removeCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_removeAllCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/north/:northId/cache/remove-all',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.removeAllCacheContent)),

            async function NorthConnectorController_removeAllCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_removeAllCacheContent, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'removeAllCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_moveCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                originFolder: {"in":"query","name":"originFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                destinationFolder: {"in":"query","name":"destinationFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                filenames: {"in":"body","name":"filenames","required":true,"dataType":"array","array":{"dataType":"string"}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/cache/move',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.moveCacheContent)),

            async function NorthConnectorController_moveCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_moveCacheContent, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'moveCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsNorthConnectorController_moveAllCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"path","name":"northId","required":true,"dataType":"string"},
                originFolder: {"in":"query","name":"originFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                destinationFolder: {"in":"query","name":"destinationFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/north/:northId/cache/move-all',
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController)),
            ...(fetchMiddlewares<RequestHandler>(NorthConnectorController.prototype.moveAllCacheContent)),

            async function NorthConnectorController_moveAllCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsNorthConnectorController_moveAllCacheContent, request, response });

                const controller = new NorthConnectorController();

              await templateService.apiHandler({
                methodName: 'moveAllCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsLogController_search: Record<string, TsoaRoute.ParameterSchema> = {
                start: {"in":"query","name":"start","required":true,"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"undefined"}]},
                end: {"in":"query","name":"end","required":true,"dataType":"union","subSchemas":[{"ref":"Instant"},{"dataType":"undefined"}]},
                levels: {"in":"query","name":"levels","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                scopeIds: {"in":"query","name":"scopeIds","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                scopeTypes: {"in":"query","name":"scopeTypes","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                messageContent: {"in":"query","name":"messageContent","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                page: {"default":0,"in":"query","name":"page","dataType":"double"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/logs',
            ...(fetchMiddlewares<RequestHandler>(LogController)),
            ...(fetchMiddlewares<RequestHandler>(LogController.prototype.search)),

            async function LogController_search(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsLogController_search, request, response });

                const controller = new LogController();

              await templateService.apiHandler({
                methodName: 'search',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsLogController_suggestScopes: Record<string, TsoaRoute.ParameterSchema> = {
                name: {"default":"","in":"query","name":"name","dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/logs/scopes/suggest',
            ...(fetchMiddlewares<RequestHandler>(LogController)),
            ...(fetchMiddlewares<RequestHandler>(LogController.prototype.suggestScopes)),

            async function LogController_suggestScopes(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsLogController_suggestScopes, request, response });

                const controller = new LogController();

              await templateService.apiHandler({
                methodName: 'suggestScopes',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsLogController_getScopeById: Record<string, TsoaRoute.ParameterSchema> = {
                scopeId: {"in":"path","name":"scopeId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/logs/scopes/:scopeId',
            ...(fetchMiddlewares<RequestHandler>(LogController)),
            ...(fetchMiddlewares<RequestHandler>(LogController.prototype.getScopeById)),

            async function LogController_getScopeById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsLogController_getScopeById, request, response });

                const controller = new LogController();

              await templateService.apiHandler({
                methodName: 'getScopeById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIPFilterController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/ip-filters',
            ...(fetchMiddlewares<RequestHandler>(IPFilterController)),
            ...(fetchMiddlewares<RequestHandler>(IPFilterController.prototype.list)),

            async function IPFilterController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIPFilterController_list, request, response });

                const controller = new IPFilterController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIPFilterController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                ipFilterId: {"in":"path","name":"ipFilterId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/ip-filters/:ipFilterId',
            ...(fetchMiddlewares<RequestHandler>(IPFilterController)),
            ...(fetchMiddlewares<RequestHandler>(IPFilterController.prototype.findById)),

            async function IPFilterController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIPFilterController_findById, request, response });

                const controller = new IPFilterController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIPFilterController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"IPFilterCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/ip-filters',
            ...(fetchMiddlewares<RequestHandler>(IPFilterController)),
            ...(fetchMiddlewares<RequestHandler>(IPFilterController.prototype.create)),

            async function IPFilterController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIPFilterController_create, request, response });

                const controller = new IPFilterController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIPFilterController_update: Record<string, TsoaRoute.ParameterSchema> = {
                ipFilterId: {"in":"path","name":"ipFilterId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"IPFilterCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/ip-filters/:ipFilterId',
            ...(fetchMiddlewares<RequestHandler>(IPFilterController)),
            ...(fetchMiddlewares<RequestHandler>(IPFilterController.prototype.update)),

            async function IPFilterController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIPFilterController_update, request, response });

                const controller = new IPFilterController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsIPFilterController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                ipFilterId: {"in":"path","name":"ipFilterId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/ip-filters/:ipFilterId',
            ...(fetchMiddlewares<RequestHandler>(IPFilterController)),
            ...(fetchMiddlewares<RequestHandler>(IPFilterController.prototype.delete)),

            async function IPFilterController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsIPFilterController_delete, request, response });

                const controller = new IPFilterController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.list)),

            async function HistoryQueryController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_list, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history/:historyId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.findById)),

            async function HistoryQueryController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_findById, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"HistoryQueryCommandDTO"},
                fromSouth: {"in":"query","name":"fromSouth","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                fromNorth: {"in":"query","name":"fromNorth","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                duplicate: {"in":"query","name":"duplicate","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.create)),

            async function HistoryQueryController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_create, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_update: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"HistoryQueryCommandDTO"},
                resetCache: {"in":"query","name":"resetCache","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/history/:historyId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.update)),

            async function HistoryQueryController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_update, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/history/:historyId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.delete)),

            async function HistoryQueryController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_delete, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_start: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/start',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.start)),

            async function HistoryQueryController_start(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_start, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'start',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_pause: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/pause',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.pause)),

            async function HistoryQueryController_pause(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_pause, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'pause',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_testNorth: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                northType: {"in":"query","name":"northType","required":true,"ref":"OIBusNorthType"},
                fromNorth: {"in":"query","name":"fromNorth","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                command: {"in":"body","name":"command","required":true,"ref":"NorthSettings"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/test/north',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.testNorth)),

            async function HistoryQueryController_testNorth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_testNorth, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'testNorth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_testSouth: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                southType: {"in":"query","name":"southType","required":true,"ref":"OIBusSouthType"},
                fromSouth: {"in":"query","name":"fromSouth","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                command: {"in":"body","name":"command","required":true,"ref":"SouthSettings"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/test/south',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.testSouth)),

            async function HistoryQueryController_testSouth(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_testSouth, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'testSouth',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_testItem: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                southType: {"in":"query","name":"southType","required":true,"ref":"OIBusSouthType"},
                itemName: {"in":"query","name":"itemName","required":true,"dataType":"string"},
                fromSouth: {"in":"query","name":"fromSouth","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                command: {"in":"body","name":"command","required":true,"ref":"HistorySouthItemTestRequest"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/test/items',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.testItem)),

            async function HistoryQueryController_testItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_testItem, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'testItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_listItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history/:historyId/items/list',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.listItems)),

            async function HistoryQueryController_listItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_listItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'listItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_searchItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                name: {"in":"query","name":"name","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                enabled: {"in":"query","name":"enabled","required":true,"dataType":"union","subSchemas":[{"dataType":"boolean"},{"dataType":"undefined"}]},
                page: {"default":0,"in":"query","name":"page","dataType":"double"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history/:historyId/items/search',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.searchItems)),

            async function HistoryQueryController_searchItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_searchItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'searchItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_findItemById: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history/:historyId/items/:itemId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.findItemById)),

            async function HistoryQueryController_findItemById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_findItemById, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'findItemById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_createItem: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"HistoryQueryItemCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.createItem)),

            async function HistoryQueryController_createItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_createItem, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'createItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_updateItem: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"HistoryQueryItemCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/history/:historyId/items/:itemId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.updateItem)),

            async function HistoryQueryController_updateItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_updateItem, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'updateItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_enableItem: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/:itemId/enable',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.enableItem)),

            async function HistoryQueryController_enableItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_enableItem, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'enableItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_disableItem: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/:itemId/disable',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.disableItem)),

            async function HistoryQueryController_disableItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_disableItem, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'disableItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_enableItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"itemIds":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/enable',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.enableItems)),

            async function HistoryQueryController_enableItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_enableItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'enableItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_disableItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"itemIds":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/disable',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.disableItems)),

            async function HistoryQueryController_disableItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_disableItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'disableItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_deleteItem: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                itemId: {"in":"path","name":"itemId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/history/:historyId/items/:itemId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.deleteItem)),

            async function HistoryQueryController_deleteItem(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_deleteItem, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'deleteItem',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_deleteItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"dataType":"nestedObjectLiteral","nestedProperties":{"itemIds":{"dataType":"array","array":{"dataType":"string"},"required":true}}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/delete',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.deleteItems)),

            async function HistoryQueryController_deleteItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_deleteItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'deleteItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_deleteAllItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/history/:historyId/items',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.deleteAllItems)),

            async function HistoryQueryController_deleteAllItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_deleteAllItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'deleteAllItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_itemsToCsv: Record<string, TsoaRoute.ParameterSchema> = {
                southType: {"in":"path","name":"southType","required":true,"dataType":"string"},
                delimiter: {"in":"formData","name":"delimiter","required":true,"dataType":"string"},
                itemsFile: {"in":"formData","name":"items","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:southType/items/to-csv',
            upload.fields([
                {
                    name: "items",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.itemsToCsv)),

            async function HistoryQueryController_itemsToCsv(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_itemsToCsv, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'itemsToCsv',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_exportItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"HistoryCsvDelimiterRequest"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/export',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.exportItems)),

            async function HistoryQueryController_exportItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_exportItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'exportItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_checkImportItems: Record<string, TsoaRoute.ParameterSchema> = {
                southType: {"in":"path","name":"southType","required":true,"dataType":"string"},
                delimiter: {"in":"formData","name":"delimiter","required":true,"dataType":"string"},
                itemsToImportFile: {"in":"formData","name":"itemsToImport","required":true,"dataType":"file"},
                currentItemsFile: {"in":"formData","name":"currentItems","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:southType/items/import/check',
            upload.fields([
                {
                    name: "itemsToImport",
                    maxCount: 1
                },
                {
                    name: "currentItems",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.checkImportItems)),

            async function HistoryQueryController_checkImportItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_checkImportItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'checkImportItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_importItems: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                itemsFile: {"in":"formData","name":"items","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/items/import',
            upload.fields([
                {
                    name: "items",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.importItems)),

            async function HistoryQueryController_importItems(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_importItems, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'importItems',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_addOrEditTransformer: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"TransformerDTOWithOptions"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/transformers',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.addOrEditTransformer)),

            async function HistoryQueryController_addOrEditTransformer(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_addOrEditTransformer, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'addOrEditTransformer',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_removeTransformer: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                transformerId: {"in":"path","name":"transformerId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/history/:historyId/transformers/:transformerId',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.removeTransformer)),

            async function HistoryQueryController_removeTransformer(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_removeTransformer, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'removeTransformer',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_searchCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                nameContains: {"in":"query","name":"nameContains","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                start: {"in":"query","name":"start","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                end: {"in":"query","name":"end","required":true,"dataType":"union","subSchemas":[{"dataType":"string"},{"dataType":"undefined"}]},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history/:historyId/cache/search',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.searchCacheContent)),

            async function HistoryQueryController_searchCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_searchCacheContent, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'searchCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_getCacheFileContent: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                filename: {"in":"path","name":"filename","required":true,"dataType":"string"},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/history/:historyId/cache/content/:filename',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.getCacheFileContent)),

            async function HistoryQueryController_getCacheFileContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_getCacheFileContent, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'getCacheFileContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_removeCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                filenames: {"in":"body","name":"filenames","required":true,"dataType":"array","array":{"dataType":"string"}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/history/:historyId/cache/remove',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.removeCacheContent)),

            async function HistoryQueryController_removeCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_removeCacheContent, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'removeCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_removeAllCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                folder: {"in":"query","name":"folder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/history/:historyId/cache/remove-all',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.removeAllCacheContent)),

            async function HistoryQueryController_removeAllCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_removeAllCacheContent, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'removeAllCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_moveCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                originFolder: {"in":"query","name":"originFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                destinationFolder: {"in":"query","name":"destinationFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                filenames: {"in":"body","name":"filenames","required":true,"dataType":"array","array":{"dataType":"string"}},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/cache/move',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.moveCacheContent)),

            async function HistoryQueryController_moveCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_moveCacheContent, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'moveCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsHistoryQueryController_moveAllCacheContent: Record<string, TsoaRoute.ParameterSchema> = {
                historyId: {"in":"path","name":"historyId","required":true,"dataType":"string"},
                originFolder: {"in":"query","name":"originFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                destinationFolder: {"in":"query","name":"destinationFolder","required":true,"dataType":"union","subSchemas":[{"dataType":"enum","enums":["cache"]},{"dataType":"enum","enums":["archive"]},{"dataType":"enum","enums":["error"]}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/history/:historyId/cache/move-all',
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController)),
            ...(fetchMiddlewares<RequestHandler>(HistoryQueryController.prototype.moveAllCacheContent)),

            async function HistoryQueryController_moveAllCacheContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsHistoryQueryController_moveAllCacheContent, request, response });

                const controller = new HistoryQueryController();

              await templateService.apiHandler({
                methodName: 'moveAllCacheContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEngineController_getEngineSettings: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/engine',
            ...(fetchMiddlewares<RequestHandler>(EngineController)),
            ...(fetchMiddlewares<RequestHandler>(EngineController.prototype.getEngineSettings)),

            async function EngineController_getEngineSettings(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEngineController_getEngineSettings, request, response });

                const controller = new EngineController();

              await templateService.apiHandler({
                methodName: 'getEngineSettings',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEngineController_updateEngineSettings: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"EngineSettingsCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/engine',
            ...(fetchMiddlewares<RequestHandler>(EngineController)),
            ...(fetchMiddlewares<RequestHandler>(EngineController.prototype.updateEngineSettings)),

            async function EngineController_updateEngineSettings(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEngineController_updateEngineSettings, request, response });

                const controller = new EngineController();

              await templateService.apiHandler({
                methodName: 'updateEngineSettings',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEngineController_resetEngineMetrics: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/engine/metrics/reset',
            ...(fetchMiddlewares<RequestHandler>(EngineController)),
            ...(fetchMiddlewares<RequestHandler>(EngineController.prototype.resetEngineMetrics)),

            async function EngineController_resetEngineMetrics(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEngineController_resetEngineMetrics, request, response });

                const controller = new EngineController();

              await templateService.apiHandler({
                methodName: 'resetEngineMetrics',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEngineController_restart: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/engine/restart',
            ...(fetchMiddlewares<RequestHandler>(EngineController)),
            ...(fetchMiddlewares<RequestHandler>(EngineController.prototype.restart)),

            async function EngineController_restart(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEngineController_restart, request, response });

                const controller = new EngineController();

              await templateService.apiHandler({
                methodName: 'restart',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEngineController_getInfo: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/engine/info',
            ...(fetchMiddlewares<RequestHandler>(EngineController)),
            ...(fetchMiddlewares<RequestHandler>(EngineController.prototype.getInfo)),

            async function EngineController_getInfo(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEngineController_getInfo, request, response });

                const controller = new EngineController();

              await templateService.apiHandler({
                methodName: 'getInfo',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsEngineController_getOIBusStatus: Record<string, TsoaRoute.ParameterSchema> = {
                _request: {"in":"request","name":"_request","required":true,"dataType":"object"},
        };
        app.get('/api/engine/status',
            ...(fetchMiddlewares<RequestHandler>(EngineController)),
            ...(fetchMiddlewares<RequestHandler>(EngineController.prototype.getOIBusStatus)),

            async function EngineController_getOIBusStatus(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsEngineController_getOIBusStatus, request, response });

                const controller = new EngineController();

              await templateService.apiHandler({
                methodName: 'getOIBusStatus',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsContentController_addFile: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"query","name":"northId","required":true,"dataType":"string"},
                file: {"in":"formData","name":"file","required":true,"dataType":"file"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/content/file',
            upload.fields([
                {
                    name: "file",
                    maxCount: 1
                }
            ]),
            ...(fetchMiddlewares<RequestHandler>(ContentController)),
            ...(fetchMiddlewares<RequestHandler>(ContentController.prototype.addFile)),

            async function ContentController_addFile(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsContentController_addFile, request, response });

                const controller = new ContentController();

              await templateService.apiHandler({
                methodName: 'addFile',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsContentController_addContent: Record<string, TsoaRoute.ParameterSchema> = {
                northId: {"in":"query","name":"northId","required":true,"dataType":"string"},
                content: {"in":"body","name":"content","required":true,"dataType":"union","subSchemas":[{"ref":"OIBusTimeValueContent"},{"ref":"OIBusSetpointContent"}]},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/content/content',
            ...(fetchMiddlewares<RequestHandler>(ContentController)),
            ...(fetchMiddlewares<RequestHandler>(ContentController.prototype.addContent)),

            async function ContentController_addContent(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsContentController_addContent, request, response });

                const controller = new ContentController();

              await templateService.apiHandler({
                methodName: 'addContent',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCertificateController_list: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/certificates',
            ...(fetchMiddlewares<RequestHandler>(CertificateController)),
            ...(fetchMiddlewares<RequestHandler>(CertificateController.prototype.list)),

            async function CertificateController_list(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCertificateController_list, request, response });

                const controller = new CertificateController();

              await templateService.apiHandler({
                methodName: 'list',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCertificateController_findById: Record<string, TsoaRoute.ParameterSchema> = {
                certificateId: {"in":"path","name":"certificateId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.get('/api/certificates/:certificateId',
            ...(fetchMiddlewares<RequestHandler>(CertificateController)),
            ...(fetchMiddlewares<RequestHandler>(CertificateController.prototype.findById)),

            async function CertificateController_findById(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCertificateController_findById, request, response });

                const controller = new CertificateController();

              await templateService.apiHandler({
                methodName: 'findById',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: undefined,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCertificateController_create: Record<string, TsoaRoute.ParameterSchema> = {
                command: {"in":"body","name":"command","required":true,"ref":"CertificateCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.post('/api/certificates',
            ...(fetchMiddlewares<RequestHandler>(CertificateController)),
            ...(fetchMiddlewares<RequestHandler>(CertificateController.prototype.create)),

            async function CertificateController_create(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCertificateController_create, request, response });

                const controller = new CertificateController();

              await templateService.apiHandler({
                methodName: 'create',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 201,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCertificateController_update: Record<string, TsoaRoute.ParameterSchema> = {
                certificateId: {"in":"path","name":"certificateId","required":true,"dataType":"string"},
                command: {"in":"body","name":"command","required":true,"ref":"CertificateCommandDTO"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.put('/api/certificates/:certificateId',
            ...(fetchMiddlewares<RequestHandler>(CertificateController)),
            ...(fetchMiddlewares<RequestHandler>(CertificateController.prototype.update)),

            async function CertificateController_update(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCertificateController_update, request, response });

                const controller = new CertificateController();

              await templateService.apiHandler({
                methodName: 'update',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsCertificateController_delete: Record<string, TsoaRoute.ParameterSchema> = {
                certificateId: {"in":"path","name":"certificateId","required":true,"dataType":"string"},
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        app.delete('/api/certificates/:certificateId',
            ...(fetchMiddlewares<RequestHandler>(CertificateController)),
            ...(fetchMiddlewares<RequestHandler>(CertificateController.prototype.delete)),

            async function CertificateController_delete(request: ExRequest, response: ExResponse, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let validatedArgs: any[] = [];
            try {
                validatedArgs = templateService.getValidatedArgs({ args: argsCertificateController_delete, request, response });

                const controller = new CertificateController();

              await templateService.apiHandler({
                methodName: 'delete',
                controller,
                response,
                next,
                validatedArgs,
                successStatus: 204,
              });
            } catch (err) {
                return next(err);
            }
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

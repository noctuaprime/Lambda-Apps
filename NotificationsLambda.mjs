import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";

// dynamo table name
const dynamoTableName = "notifications";
const dynamoTableRegion = "us-east-1";
const dynamoDBClient = new DynamoDBClient({ region: dynamoTableRegion });
const dynamo = DynamoDBDocumentClient.from(dynamoDBClient);

// request methods
const REQUEST_METHOD = {
  POST: "POST",
  GET: "GET",
  DELETE: "DELETE",
  PATCH: "PATCH"
};

// status codes
const STATUS_CODE = {
  SUCCESS: 200,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  SERVER_ERROR: 500
};

// API Paths
const notificationPath = "/notifications";
const notificationParamPath = `${notificationPath}/{notificationID}`;

// Lambda Handler
export const handler = async (event, context) => {
  console.log("Request event method: ", event.httpMethod);
  console.log("EVENT\n" + JSON.stringify(event, null, 2));

  let response;

  switch (true) {
    // add notification
    case event.httpMethod === REQUEST_METHOD.POST &&
      event.requestContext.resourcePath === notificationPath:
      response = await saveNotification(JSON.parse(event.body));
      break;
    // get notification
    case event.httpMethod === REQUEST_METHOD.GET &&
      event.requestContext.resourcePath === notificationParamPath:
      response = await getNotification(event.pathParameters.notificationID);
      break;
    // invalid requests
    default:
      response = buildResponse(
        STATUS_CODE.NOT_FOUND,
        event.requestContext.resourcePath
      );
      break;
  }
  return response;
};

// FUNCTION FOR SAVING NEW NOTIFICATIONS
async function saveNotification(notification) {
  const commandParams = {
    TableName: dynamoTableName,
    Item: notification
  };
  const command = new PutCommand(commandParams);
  try {
    await dynamo.send(command);
    const responseBody = {
      Operation: "SAVE",
      Message: "SUCCESS",
      Item: notification
    };
    return buildResponse(STATUS_CODE.SUCCESS, responseBody);
  } catch (error) {
    console.error("Error saving notification: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, { error: "Failed to save notification" });
  }
}

// FUNCTION FOR GETTING NOTIFICATION BY ID
async function getNotification(notificationID) {
  if (!notificationID) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, { error: "Missing notification ID" });
  }

  const params = {
    TableName: dynamoTableName,
    Key: { notificationID: notificationID }
  };
  const command = new GetCommand(params);
  try {
    const response = await dynamo.send(command);
    return response.Item
        ? buildResponse(STATUS_CODE.SUCCESS, response.Item)
        : buildResponse(STATUS_CODE.NOT_FOUND, { message: "Notification not found" });
  } catch (error) {
    console.error("Error retrieving notification: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, { error: "Failed to retrieve notification" });
  }
}

// utility function to build the response
function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
  };
}

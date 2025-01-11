import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

// dynamo table name
const dynamoTableName = "orders";
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
const ordersPath = "/orders";
const ordersIDPath = `${ordersPath}/{ordersID}`;
const ordersUserIDPath = `${ordersPath}/user/{id}`;

export const handler = async (event, context) => {

  console.log("Request event method: ", event.httpMethod);
  console.log("EVENT\n" + JSON.stringify(event, null, 2));

  let response;

  switch (true) {

    // add new order
    case event.httpMethod === REQUEST_METHOD.POST &&
      event.requestContext.resourcePath === ordersPath:
      response = await addOrder(JSON.parse(event.body));
      break;

    // Retrieve a list of all orders or filter by status
    case event.httpMethod === REQUEST_METHOD.GET &&
      event.requestContext.resourcePath === ordersPath:
      //response = await listAllOrders(JSON.parse(event.body));
      response = await listAllOrders();
      break;

    // Modify an existing order
    case event.httpMethod === REQUEST_METHOD.PATCH &&
      event.requestContext.resourcePath === ordersIDPath:
      response = await modifyOrder(JSON.parse(event.body));
      break;

    // Retrieve orders for a specific user
    case event.httpMethod === REQUEST_METHOD.GET &&
      event.requestContext.resourcePath === ordersUserIDPath:
      response = await listUserOrders(event);
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


// add new order

async function addOrder(requestBody) {
  if (!requestBody) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, {
      error: "Invalid order object",
    });
  }

  const commandParams = {
    TableName: dynamoTableName,
    Item: requestBody,
  };
  const command = new PutCommand(commandParams);
  try {
    await dynamo.send(command);
    const responseBody = {
      Operation: "SAVE",
      Message: "SUCCESS",
      Item: requestBody,
    };
    return buildResponse(STATUS_CODE.SUCCESS, responseBody);
  } catch (error) {
    console.error("Error saving order: ", error);
      return buildResponse(STATUS_CODE.SERVER_ERROR, {
        error: "Failed to save order",
      });
  }
}

// list all orders

async function listAllOrders() {
  const params = {
    TableName: dynamoTableName,
  };
  const command = new ScanCommand(params);

  try {
    const response = await dynamo.send(command);
    return buildResponse(STATUS_CODE.SUCCESS, { orders: response.Items });
  } catch (error) {
    console.error("Error listing orders: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, {
      error: "Failed to list orders",
    });
  }
}

// modify order
async function modifyOrder(requestBody) {
  if (!requestBody || !requestBody.orderID || !requestBody.updateKey || !requestBody.updateValue) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, {
      error: "Invalid update request",
    });
  }

  const params = {
    TableName: dynamoTableName,
    Key: {
      id: orderID,
    },
    UpdateExpression: `set ${requestBody.updateKey} = :v_updateItems`,
    ExpressionAttributeValues: {
      ":v_updateItems": requestBody.updateValue,
    },
    ReturnValues: "UPDATED_NEW",
  };
  const command = new UpdateCommand(params);
  try {
    const response = await dynamo.send(command);
    const responseBody = {
      Operation: "UPDATE",
      Message: "SUCCESS",
      UpdatedAttributes: response,
    };
    return buildResponse(STATUS_CODE.SUCCESS, responseBody);
  } catch (error) {
    console.error("Error updating order: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, {
      error: "Failed to update order",
    });
  }
}

// Retrieve orders for a specific user
async function listUserOrders(event) {
  const resourcePath = event?.requestContext?.resourcePath || "N/A";
  console.log("Resource Path:", resourcePath);

  const userID = event?.pathParameters?.id;

  if (!userID) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, {
      error: "Missing user ID",
    });
  }

  // Define DynamoDB query parameters
  const params = {
    TableName: dynamoTableName,
    KeyConditionExpression: "id = :userID",
    ExpressionAttributeValues: {
      ":userID": userID,
    },
  };

  try {
    const command = new QueryCommand(params);
    const response = await dynamo.send(command);

    return buildResponse(STATUS_CODE.SUCCESS, { orders: response.Items });
  } catch (error) {
    console.error("Error retrieving user orders: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, {
      error: "Failed to retrieve user orders",
    });
  }
}

// utility function to build the response
function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  };
}

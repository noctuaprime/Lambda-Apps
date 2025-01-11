import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";

// dynamo table name
const dynamoTableName = "accounts";
// dyname region
const dynamoTableRegion = "us-east-1";

const dynamoDBClient = new DynamoDBClient({ region: dynamoTableRegion });
const dynamo = DynamoDBDocumentClient.from(dynamoDBClient);

// define all request methods here
const REQUEST_METHOD = {
  POST: "POST",
  GET: "GET",
  DELETE: "DELETE",
  PATCH: "PATCH",
};

// define all status codes here
const STATUS_CODE = {
  SUCCESS: 200,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  SERVER_ERROR: 500
};

// paths
const accountPath = "/account";
const accountsPath = "/accounts";
const accountParamPath = `${accountPath}/{id}`;
const accountLoginPath = `${accountPath}/login`;
//const usersPath = "/users";

export const handler = async (event, context) => {
  console.log("Request event method: ", event.httpMethod);
  console.log("EVENT\n" + JSON.stringify(event, null, 2));

  let response;

  switch (true) {
    // add new user
    case event.httpMethod === REQUEST_METHOD.POST &&
      event.requestContext.resourcePath === accountsPath:
      response = await saveUser(JSON.parse(event.body));
      break;
    // get user by id by path param (get under accounts/{id})
    case event.httpMethod === REQUEST_METHOD.GET &&
      event.requestContext.resourcePath === accountParamPath:
     response = await getAccountID(String(event.pathParameters.id));
      // response = await getUser(3);
      break;
    //Log in a user
    case event.httpMethod === REQUEST_METHOD.PATCH &&
      event.requestContext.resourcePath === accountLoginPath:
     response = await loginAccount(String(event.pathParameters.email), String(event.pathParameters.password));
     break;
    // modify user
    case event.httpMethod === REQUEST_METHOD.PATCH &&
      event.requestContext.resourcePath === accountParamPath:
      response = await modifyUser(JSON.parse(event.body), String(event.pathParameters.id));
      break;
    // delete a user
    case event.httpMethod === REQUEST_METHOD.DELETE &&
      event.requestContext.resourcePath === accountParamPath:
      response = await deleteUser(String(event.pathParameters.id));
      break;
    // get all users
    case event.httpMethod === REQUEST_METHOD.GET &&
      event.requestContext.resourcePath === accountsPath:
      response = await getUsers();
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

//FUNCTION FOR POSTING NEW USERS
async function saveUser(requestBody) {
  if (!requestBody || !requestBody.id || !requestBody.name) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, { error: "Missing required fields: id, name" });
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
    console.error(
      "Do your custom error handling here. I am just gonna log it: ",
      error
    );
  }
}

//FUNCTION TO GET USER BY THEIR ID
async function getAccountID(MemberId) {
  const params = {
    TableName: dynamoTableName,
    Key: {
    id: MemberId,
    },
  };

  console.log("Getting ID: ", MemberId);
  const command = new GetCommand(params);
  try {
    const response = await dynamo.send(command);
    return buildResponse(STATUS_CODE.SUCCESS, response.Item);
  } catch (error) {
    console.error("Error fetching user: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, { error: "Failed to fetch user" });
  }
}

//FUNCTION TO MODIFY USER USING INFORMATION PROVIDED IN THE BODY
async function modifyUser(requestBody, MemberId) {
  if (!MemberId || !requestBody.updateKey || !requestBody.updateValue) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, { error: "Invalid input: MemberId, updateKey, and updateValue are required" });
  }

  const params = {
    TableName: dynamoTableName,
    Key: {
      id: MemberId,
    },
    UpdateExpression: `set ${requestBody.updateKey} = :value`,
    ExpressionAttributeValues: {
      ":value": requestBody.updateValue,
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
    console.error(
      "Do your custom error handling here. I am just gonna log it: ",
      error
    );
  }
}

//FUNCTION TO GET DELETE A USER BY THEIR ID AS A QUERY PARAMETER
//******NOTE****** TYPICALLY USERIDS SHOULD NOT BE USED AS QUERY PARAMETERS
async function deleteUser(userID) {
  const params = {
    TableName: dynamoTableName,
    Key: {
      id: userID,
    },
    ReturnValues: "ALL_OLD",
  };
  const command = new DeleteCommand(params);
  try {
    const response = await dynamo.send(command);
    const responseBody = {
      Operation: "DELETE",
      Message: "SUCCESS",
      Item: response,
    };
    return buildResponse(STATUS_CODE.SUCCESS, responseBody);
  } catch (error) {
    console.error(
      "Error Deleting User: ",
      error
    );
  }
}

//FUNCTION TO GET ALL USERS
async function getUsers() {
  const params = {
    TableName: dynamoTableName,
  };
  const response = await dynamo.send(new ScanCommand(params));
  const responseBody = {
    users: response.Items,
  };
  return buildResponse(STATUS_CODE.SUCCESS, responseBody);
}

//log in a user
async function loginAccount(userEmail, userPassword) {

  if (!loginBody || !loginBody.username || !loginBody.password) {
    return buildResponse(STATUS_CODE.BAD_REQUEST, { error: "Username and password are required" });
  }

  const scanParams = {
    TableName: dynamoTableName,
    FilterExpression: "login.email = :v_email AND login.password = :v_password",
    ExpressionAttributeValues: {
      ":v_email": userEmail,
      ":v_password": userPassword
    },
  };

  let foundItem;

  try {
    const scanDatabase = new ScanCommand(scanParams);
    const scanResponse = await dynamo.send(scanDatabase);
    if (scanResponse.Items && scanResponse.Items.length > 0) {
      foundItem = scanResponse.Items[0].id;

    }
    else {
      return buildResponse(STATUS_CODE.NOT_FOUND, {error: "Incorrect Login Credentials"});
    }
  }
  catch(error){
    console.error("Error Scanning for the Account", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, {error: "Internal server error when searching for the account"})
  }

  const loginParams = {
    TableName: dynamoTableName,
    Key: {
      id: foundItem,
    },
    UpdateExpression: set activity.active = :v_activity,
    ExpressionAttributeValues: {
      ":v_activity": true,
    },
    ReturnValues: "UPDATED_NEW",
  };


  const command = new UpdateCommand(loginParams);
  try {
    await dynamo.send(command);
    const responseBody = {
      Operation: "LOGIN",
      Message: "SUCCESS",
    };
  return buildResponse(STATUS_CODE.SUCCESS, responseBody);
  } catch (error) {
    console.error("Error logging into the server: ", error);
    return buildResponse(STATUS_CODE.SERVER_ERROR, { error: "Failed to log into the server"});
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

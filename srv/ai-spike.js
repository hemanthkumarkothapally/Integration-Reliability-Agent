// const ai = await cds.connect.to('GenAIHubDestination');

// const deployments = await ai.send({
//   method: 'GET',
//   path: '/v2/lm/deployments',
//   headers: {
//     'AI-Resource-Group': 'default'
//   }
// });

// console.log(deployments);

const ai = await cds.connect.to('GenAIHubDestination');

const result = await ai.send({
  method: 'POST',
  path: '/inferenc/deployments/d2f31ccfd2765c35/invoke',
  headers: {
    'Content-Type': 'application/json',
    'AI-Resource-Group': 'default'
  },
  data: {
    messages: [
      {
        role: 'user',
        content: 'Hello from CAP!'
      }
    ],
    max_tokens: 256,
    anthropic_version: "bedrock-2023-05-31"
  }
});

console.log(result);

// import { AzureOpenAiChatClient } from '@sap-ai-sdk/foundation-models';
// const client = new AzureOpenAiChatClient({ modelName: 'Claude' });
// const result = await client.run({ messages: [{ role: 'user', content: 'Hello from CAP!' }] });
// console.log(result)
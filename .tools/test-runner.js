#!/usr/bin/env node

const inquirer = require('inquirer');
const axios = require('axios');
const chalk = require('chalk');
const ora = require('ora');
const Table = require('cli-table3');
const figlet = require('figlet');
const fs = require('fs');
const path = require('path');

// Load config
const config = require('./config.json');
const api = axios.create({
  baseURL: config.baseUrl,
  timeout: config.stressTest.timeoutMs
});

// Test result storage
let testResults = [];
let currentTest = null;

// Utility functions
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const displayTitle = () => {
  console.log(chalk.cyan(figlet.textSync('API Tester', { horizontalLayout: 'full' })));
  console.log(chalk.gray('='.repeat(80)));
};

const displayResults = (results) => {
  const table = new Table({
    head: ['Endpoint', 'Method', 'Status', 'Time (ms)', 'Result'].map(h => chalk.cyan(h)),
    colWidths: [30, 10, 10, 12, 20]
  });

  results.forEach(r => {
    table.push([
      r.endpoint,
      r.method,
      r.status === 'success' ? chalk.green(r.status) : chalk.red(r.status),
      r.time,
      r.result
    ]);
  });

  console.log(table.toString());
};

// Test functions
async function runEndpointTest(method, endpoint, data = null) {
  const spinner = ora(`Testing ${method} ${endpoint}`).start();
  const start = Date.now();
  
  try {
    let response;
    switch (method) {
      case 'GET':
        response = await api.get(endpoint);
        break;
      case 'POST':
        response = await api.post(endpoint, data);
        break;
      case 'PUT':
        response = await api.put(endpoint, data);
        break;
      case 'DELETE':
        response = await api.delete(endpoint);
        break;
    }
    
    const time = Date.now() - start;
    spinner.succeed(chalk.green(`${method} ${endpoint} - Success (${time}ms)`));
    
    return {
      endpoint,
      method,
      status: 'success',
      time,
      result: `${response.status} OK`
    };
  } catch (error) {
    const time = Date.now() - start;
    spinner.fail(chalk.red(`${method} ${endpoint} - Failed (${time}ms)`));
    
    return {
      endpoint,
      method,
      status: 'failed',
      time,
      result: error.response ? `${error.response.status} Error` : 'Network Error'
    };
  }
}

async function runStressTest(endpoint, method = 'GET', data = null) {
  const results = {
    successful: 0,
    failed: 0,
    totalTime: 0,
    avgResponseTime: 0
  };

  const startTime = Date.now();
  const endTime = startTime + (config.stressTest.duration * 1000);
  
  console.log(chalk.yellow(`\nStarting stress test for ${endpoint}`));
  console.log(chalk.gray(`Running for ${config.stressTest.duration} seconds with ${config.stressTest.concurrentRequests} concurrent requests\n`));

  const spinner = ora('Stress testing in progress').start();
  
  while (Date.now() < endTime) {
    const promises = [];
    
    for (let i = 0; i < config.stressTest.concurrentRequests; i++) {
      promises.push(runEndpointTest(method, endpoint, data));
      await sleep(config.stressTest.requestDelay);
    }
    
    const batchResults = await Promise.all(promises);
    
    batchResults.forEach(result => {
      if (result.status === 'success') results.successful++;
      else results.failed++;
      results.totalTime += result.time;
    });
  }

  spinner.stop();
  
  results.avgResponseTime = results.totalTime / (results.successful + results.failed);
  
  console.log('\nStress Test Results:');
  console.log(chalk.green(`Successful requests: ${results.successful}`));
  console.log(chalk.red(`Failed requests: ${results.failed}`));
  console.log(chalk.blue(`Average response time: ${Math.round(results.avgResponseTime)}ms`));
  
  return results;
}

// Menu options
const mainMenu = async () => {
  displayTitle();
  
  const choices = [
    'Run All Tests',
    'Test Single Endpoint',
    'Run Stress Test',
    'Modify Configuration',
    'Exit'
  ];

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices
    }
  ]);

  switch (action) {
    case 'Run All Tests':
      await runAllTests();
      break;
    case 'Test Single Endpoint':
      await testSingleEndpoint();
      break;
    case 'Run Stress Test':
      await stressTestMenu();
      break;
    case 'Modify Configuration':
      await modifyConfig();
      break;
    case 'Exit':
      console.log(chalk.yellow('\nGoodbye!'));
      process.exit(0);
  }

  await mainMenu();
};

async function runAllTests() {
  console.log(chalk.cyan('\nRunning all endpoint tests...\n'));
  testResults = [];
  
  // GET all products
  testResults.push(await runEndpointTest('GET', config.endpoints.products));
  
  // POST new product
  const newProduct = await runEndpointTest('POST', config.endpoints.products, config.testData.product);
  
  if (newProduct.status === 'success') {
    const productId = JSON.parse(newProduct.result).id;
    
    // GET single product
    testResults.push(await runEndpointTest('GET', `${config.endpoints.products}/${productId}`));
    
    // PUT update product
    testResults.push(await runEndpointTest('PUT', `${config.endpoints.products}/${productId}`, {
      ...config.testData.product,
      name: 'Updated Test Product'
    }));
    
    // DELETE product
    testResults.push(await runEndpointTest('DELETE', `${config.endpoints.products}/${productId}`));
  }
  
  console.log('\nTest Results:');
  displayResults(testResults);
}

async function testSingleEndpoint() {
  const { endpoint, method, useData } = await inquirer.prompt([
    {
      type: 'list',
      name: 'endpoint',
      message: 'Select endpoint to test:',
      choices: [
        'GET /api/products',
        'GET /api/products/:id',
        'POST /api/products',
        'PUT /api/products/:id',
        'DELETE /api/products/:id'
      ]
    },
    {
      type: 'list',
      name: 'method',
      message: 'Select HTTP method:',
      choices: ['GET', 'POST', 'PUT', 'DELETE']
    },
    {
      type: 'confirm',
      name: 'useData',
      message: 'Include request body?',
      when: (answers) => ['POST', 'PUT'].includes(answers.method)
    }
  ]);

  let data = null;
  if (useData) {
    data = config.testData.product;
  }

  const result = await runEndpointTest(method, config.endpoints.products, data);
  displayResults([result]);
}

async function stressTestMenu() {
  const { endpoint, method } = await inquirer.prompt([
    {
      type: 'list',
      name: 'endpoint',
      message: 'Select endpoint to stress test:',
      choices: ['GET /api/products', 'GET /api/products/:id']
    },
    {
      type: 'list',
      name: 'method',
      message: 'Select HTTP method:',
      choices: ['GET']
    }
  ]);

  await runStressTest(config.endpoints.products, method);
}

async function modifyConfig() {
  const { setting, value } = await inquirer.prompt([
    {
      type: 'list',
      name: 'setting',
      message: 'Select setting to modify:',
      choices: [
        'Base URL',
        'Concurrent Requests',
        'Request Delay',
        'Test Duration',
        'Timeout'
      ]
    },
    {
      type: 'input',
      name: 'value',
      message: 'Enter new value:'
    }
  ]);

  switch (setting) {
    case 'Base URL':
      config.baseUrl = value;
      break;
    case 'Concurrent Requests':
      config.stressTest.concurrentRequests = parseInt(value);
      break;
    case 'Request Delay':
      config.stressTest.requestDelay = parseInt(value);
      break;
    case 'Test Duration':
      config.stressTest.duration = parseInt(value);
      break;
    case 'Timeout':
      config.stressTest.timeoutMs = parseInt(value);
      break;
  }

  fs.writeFileSync(
    path.join(__dirname, 'config.json'),
    JSON.stringify(config, null, 2)
  );

  console.log(chalk.green('\nConfiguration updated successfully!'));
}

// Start the application
mainMenu().catch(console.error);

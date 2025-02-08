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
    head: ['Endpoint', 'Method', 'Status', 'Time (ms)', 'Result', 'Details'].map(h => chalk.cyan(h)),
    colWidths: [30, 10, 10, 12, 15, 30]
  });

  results.forEach(r => {
    table.push([
      r.endpoint,
      r.method,
      r.status === 'success' ? chalk.green(r.status) : chalk.red(r.status),
      r.time,
      r.result,
      r.details || ''
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
      result: `${response.status} OK`,
      details: response.data._id ? `ID: ${response.data._id}` : undefined
    };
  } catch (error) {
    const time = Date.now() - start;
    spinner.fail(chalk.red(`${method} ${endpoint} - Failed (${time}ms)`));
    
    return {
      endpoint,
      method,
      status: 'failed',
      time,
      result: error.response ? `${error.response.status} Error` : 'Network Error',
      details: error.response?.data?.message || error.message
    };
  }
}

async function addMultipleProducts() {
  const { source, count } = await inquirer.prompt([
    {
      type: 'list',
      name: 'source',
      message: 'How would you like to add products?',
      choices: [
        'Use sample products',
        'Create custom products',
        'Create random products'
      ]
    },
    {
      type: 'input',
      name: 'count',
      message: 'How many products would you like to add?',
      default: '1',
      when: (answers) => answers.source !== 'Use sample products',
      validate: (value) => {
        const num = parseInt(value);
        return !isNaN(num) && num > 0 ? true : 'Please enter a valid number greater than 0';
      }
    }
  ]);

  const results = [];
  
  if (source === 'Use sample products') {
    console.log(chalk.cyan('\nAdding sample products...\n'));
    for (const product of config.testData.sampleProducts) {
      results.push(await runEndpointTest('POST', config.endpoints.products, product));
    }
  } else if (source === 'Create custom products') {
    for (let i = 0; i < parseInt(count); i++) {
      const product = await promptForProductDetails(i + 1);
      results.push(await runEndpointTest('POST', config.endpoints.products, product));
    }
  } else {
    console.log(chalk.cyan('\nGenerating random products...\n'));
    for (let i = 0; i < parseInt(count); i++) {
      const product = generateRandomProduct(i + 1);
      results.push(await runEndpointTest('POST', config.endpoints.products, product));
    }
  }

  console.log('\nProduct Addition Results:');
  displayResults(results);
}

async function promptForProductDetails(index) {
  console.log(chalk.cyan(`\nEnter details for product #${index}:`));
  
  const product = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Product name:',
      validate: (value) => value.length > 0 ? true : 'Name is required'
    },
    {
      type: 'input',
      name: 'description',
      message: 'Product description:',
      validate: (value) => value.length > 0 ? true : 'Description is required'
    },
    {
      type: 'number',
      name: 'price',
      message: 'Price:',
      validate: (value) => value >= 0 ? true : 'Price must be greater than or equal to 0'
    },
    {
      type: 'number',
      name: 'stock',
      message: 'Stock quantity:',
      validate: (value) => value >= 0 ? true : 'Stock must be greater than or equal to 0'
    },
    {
      type: 'list',
      name: 'category',
      message: 'Category:',
      choices: ['electronics', 'clothing', 'books', 'furniture', 'food', 'toys', 'sports', 'appliances', 'other']
    }
  ]);

  return product;
}

function generateRandomProduct(index) {
  const categories = ['electronics', 'clothing', 'books', 'furniture', 'food', 'toys', 'sports', 'appliances'];
  const adjectives = ['Premium', 'Deluxe', 'Professional', 'Basic', 'Advanced', 'Smart', 'Ultra', 'Super'];
  const productTypes = ['Widget', 'Gadget', 'Tool', 'Device', 'Kit', 'System', 'Pack', 'Set'];

  return {
    name: `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${productTypes[Math.floor(Math.random() * productTypes.length)]} ${index}`,
    description: `Auto-generated test product #${index}`,
    price: +(Math.random() * 1000).toFixed(2),
    stock: Math.floor(Math.random() * 100) + 1,
    category: categories[Math.floor(Math.random() * categories.length)]
  };
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
    'Add Products',
    'View Products',
    'Run Basic CRUD Tests',
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
    case 'Add Products':
      await addMultipleProducts();
      break;
    case 'View Products':
      const result = await runEndpointTest('GET', config.endpoints.products);
      if (result.status === 'success') {
        console.log('\nCurrent Products:');
        console.log(JSON.stringify(result.data, null, 2));
      }
      break;
    case 'Run Basic CRUD Tests':
      await runBasicTests();
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

async function runBasicTests() {
  console.log(chalk.cyan('\nRunning basic CRUD tests...\n'));
  testResults = [];
  
  // GET all products
  testResults.push(await runEndpointTest('GET', config.endpoints.products));
  
  // POST new product
  const newProduct = await runEndpointTest('POST', config.endpoints.products, config.testData.product);
  testResults.push(newProduct);
  
  if (newProduct.status === 'success') {
    const productId = newProduct.details.split('ID: ')[1];
    
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

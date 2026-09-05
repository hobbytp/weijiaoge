// scripts/test-batch-and-circuit-breaker.mjs
import assert from 'node:assert';
import { LLMScanner } from '../fetchers/llm-scanner.mjs';
import { SmartDiscoveryExtractor } from '../fetchers/smart-discovery.mjs';

async function testCircuitBreakerOnQuota429() {
  console.log('🧪 [Test 1] 测试 429 Quota Exhausted 智能熔断机制...');

  const scanner = new LLMScanner();
  scanner.minIntervalMs = 0; // 测试中避免额外等待

  // 模拟两个提供商：第一个会遭遇 429 配额耗尽，第二个正常
  scanner.providers.gemini.apiKey = 'fake-gemini-key';
  scanner.providers.deepseek.apiKey = 'fake-deepseek-key';

  let callCountGemini = 0;
  let callCountDeepseek = 0;

  // 模拟 fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url.includes('generativelanguage.googleapis.com')) {
      callCountGemini++;
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({
          error: {
            code: 429,
            message: "Quota exceeded for quota metric 'GenerateContent Requests' and limit 'RESOURCE_EXHAUSTED'",
            status: "RESOURCE_EXHAUSTED"
          }
        }),
        headers: new Map()
      };
    } else if (url.includes('deepseek')) {
      callCountDeepseek++;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  pages: [
                    {
                      id: "page_1",
                      cases: [
                        {
                          title: "3D Figurine Case",
                          prompt: "a cute 3d vinyl figurine of a banana",
                          category: "3d-figurine",
                          effects: ["3D Figurine"],
                          images: ["https://example.com/banana.jpg"]
                        }
                      ]
                    }
                  ]
                })
              }
            }
          ]
        })
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const pages = [{ id: "page_1", url: "https://example.com/1", title: "Page 1", content: "Nano banana prompt test" }];
    
    // 第一次调用：Gemini 遇到 429 配额耗尽，应立即熔断并切换至 DeepSeek
    const result1 = await scanner.scanBatch(pages);

    assert.strictEqual(callCountGemini, 1, 'Gemini 遇到配额耗尽后应立即抛出熔断，不得进行无意义重试');
    assert.strictEqual(callCountDeepseek, 1, '应自动容灾降级并成功调用 DeepSeek');
    assert.strictEqual(scanner.providers.gemini.isExhausted, true, 'Gemini 应被标记为已熔断 (isExhausted = true)');
    assert.strictEqual(result1["page_1"]?.length, 1, '应成功从 DeepSeek 返回提取结果');
    assert.strictEqual(result1["page_1"][0].title, "3D Figurine Case");

    // 第二次调用：后续页面应当直接跳过 Gemini，0ms 延迟直接调用 DeepSeek
    const result2 = await scanner.scanBatch(pages);
    assert.strictEqual(callCountGemini, 1, '第二次调用时已熔断的 Gemini 不应被再次调用');
    assert.strictEqual(callCountDeepseek, 2, '第二次调用直接由 DeepSeek 响应');

    console.log('✅ [Test 1 通过] 429 配额熔断与零延迟故障转移工作正常！\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function testBatchPackingAndParsing() {
  console.log('🧪 [Test 2] 测试多网页批量打包 (scanBatch) 与容错解析...');

  const scanner = new LLMScanner();
  scanner.minIntervalMs = 0;
  scanner.providers.deepseek.apiKey = 'fake-deepseek-key';

  const originalFetch = globalThis.fetch;
  let receivedPayload = null;

  globalThis.fetch = async (url, options) => {
    receivedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              // 测试 markdown ```json 包裹的兼容解析
              content: "```json\n" + JSON.stringify({
                pages: [
                  {
                    id: "p1",
                    cases: [{ title: "Case 1", prompt: "prompt 1", category: "style-transfer" }]
                  },
                  {
                    id: "p2",
                    cases: [{ title: "Case 2", prompt: "prompt 2", category: "3d-figurine" }]
                  },
                  {
                    id: "p3",
                    cases: []
                  }
                ]
              }) + "\n```"
            }
          }
        ]
      })
    };
  };

  try {
    const pages = [
      { id: "p1", url: "https://example.com/p1", title: "P1", content: "Content of page 1" },
      { id: "p2", url: "https://example.com/p2", title: "P2", content: "Content of page 2" },
      { id: "p3", url: "https://example.com/p3", title: "P3", content: "Content of page 3" }
    ];

    const results = await scanner.scanBatch(pages);

    assert.ok(receivedPayload.messages[1].content.includes('=== PAGE 1 [ID: p1]'));
    assert.ok(receivedPayload.messages[1].content.includes('=== PAGE 2 [ID: p2]'));
    assert.ok(receivedPayload.messages[1].content.includes('=== PAGE 3 [ID: p3]'));

    assert.strictEqual(results["p1"]?.length, 1);
    assert.strictEqual(results["p1"][0].title, "Case 1");
    assert.strictEqual(results["p2"]?.length, 1);
    assert.strictEqual(results["p2"][0].title, "Case 2");
    assert.strictEqual(results["p3"]?.length, 0);

    console.log('✅ [Test 2 通过] 多网页批量打包、Markdown JSON 解构与映射校验成功！\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function testStrictHeuristicGating() {
  console.log('🧪 [Test 3] 测试严格双维度启发式初筛 (isCandidateForLLM)...');

  const smartDiscovery = new SmartDiscoveryExtractor();

  // 1. 直接主题强关联（应当通过）
  assert.strictEqual(smartDiscovery.isCandidateForLLM('这是关于 Nano Banana 生图案例的讨论页面，详细记录了如何生成手办'), true, 'Nano Banana 应该直接通过');
  assert.strictEqual(smartDiscovery.isCandidateForLLM('微蕉阁收集整理了一系列关于 Gemini 图像处理的优秀示例和技巧'), true, '微蕉 应该直接通过');
  assert.strictEqual(smartDiscovery.isCandidateForLLM('Gemini Flash Image preview capabilities and sample generations'), true, 'Gemini Flash Image 应该直接通过');

  // 2. 双维度（生图领域 + Prompt结构）（应当通过）
  const validFluxCase = 'Here is a Flux.1 dev LoRA for photorealistic portraits. Usage: Prompt: `1girl in cyberpunk street, 8k resolution, cinematic lighting`';
  assert.strictEqual(smartDiscovery.isCandidateForLLM(validFluxCase), true, '生图模型 + Prompt 结构应当通过');

  const validMidjourneyCase = 'Midjourney v6 风格迁移指南。输入提示词：一个粘土材质的香蕉手办，置身于极简现代展厅中。参数设置：--ar 16:9 --v 6.0';
  assert.strictEqual(smartDiscovery.isCandidateForLLM(validMidjourneyCase), true, '中文生图 + 提示词应当通过');

  // 3. 常见非生图误判页面（应当被拦截并返回 false，节约大模型额度）
  const jsLibrary = 'A lightweight JavaScript library to generate random UUIDs and alphanumeric characters in the browser or Node.js environment.';
  assert.strictEqual(smartDiscovery.isCandidateForLLM(jsLibrary), false, '普通包含 generate/character 的 JS 库应被严格初筛拦截');

  const newsArticle = 'Tech giant reports strong quarterly revenue and plans to hire more engineering personnel in the upcoming financial year.';
  assert.strictEqual(smartDiscovery.isCandidateForLLM(newsArticle), false, '普通科技新闻应被严格初筛拦截');

  const cssGuide = 'CSS Tricks: how to adjust lighting, shadow, and background color with modern CSS variables and flexbox layouts.';
  assert.strictEqual(smartDiscovery.isCandidateForLLM(cssGuide), false, '普通前端 CSS 文章应被严格初筛拦截');

  console.log('✅ [Test 3 通过] 严格双维度初筛过滤准确率 100%！\n');
}

async function runAll() {
  try {
    await testCircuitBreakerOnQuota429();
    await testBatchPackingAndParsing();
    testStrictHeuristicGating();
    console.log('🎉 所有单元测试全部顺利通过！');
  } catch (err) {
    console.error('❌ 测试失败:', err);
    process.exit(1);
  }
}

runAll();

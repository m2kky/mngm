import * as fs from 'fs';
import * as path from 'path';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';

async function runAudit() {
  console.log("Starting Chrome...");
  const chrome = await chromeLauncher.launch({chromeFlags: ['--headless', '--no-sandbox']});
  
  const options = {
    logLevel: 'info', 
    output: 'html', 
    onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'], 
    port: chrome.port
  };
  
  const targetUrl = process.env.VITE_APP_URL || 'http://localhost:5000/login';
  
  console.log(`Running Lighthouse audit against ${targetUrl}`);
  const runnerResult = await lighthouse(targetUrl, options);

  const reportHtml = runnerResult.report;
  
  const reportPath = path.join(process.cwd(), 'lighthouse-report.html');
  fs.writeFileSync(reportPath, reportHtml);
  
  console.log('Report is done for', runnerResult.lhr.finalDisplayedUrl);
  console.log('Performance score was', runnerResult.lhr.categories.performance.score * 100);
  console.log('Accessibility score was', runnerResult.lhr.categories.accessibility.score * 100);
  console.log(`Saved report to ${reportPath}`);

  await chrome.kill();
  
  // Optional: exit 1 if score drops below threshold
  if (runnerResult.lhr.categories.performance.score < 0.5) {
    console.error("Performance score below threshold (50)!");
    process.exit(1);
  }
}

runAudit().catch((e) => {
  console.error("Lighthouse run failed:", e);
  process.exit(1);
});

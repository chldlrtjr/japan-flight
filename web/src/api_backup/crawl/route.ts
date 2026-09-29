import { NextResponse } from 'next/server';
import { exec } from 'node:child_process';
import path from 'node:path';
import util from 'node:util';

const execAsync = util.promisify(exec);

export async function POST() {
  try {
    const rootDir = path.resolve(process.cwd(), '..');
    const runnerPath = path.join(rootDir, 'crawler', 'runner.py');

    console.log('[API Crawl] Executing crawler:', runnerPath);

    const { stdout, stderr } = await execAsync(`python "${runnerPath}" --json`, {
      cwd: rootDir,
      timeout: 90000,
    });

    let crawlResult = null;
    const startIdx = stdout.indexOf('--- JSON_RESULT_START ---');
    const endIdx = stdout.indexOf('--- JSON_RESULT_END ---');

    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = stdout.substring(startIdx + '--- JSON_RESULT_START ---'.length, endIdx).trim();
      try {
        crawlResult = JSON.parse(jsonStr);
      } catch (err) {
        console.error('Failed to parse crawler JSON output:', err);
      }
    }

    return NextResponse.json({
      success: true,
      message: '크롤링이 성공적으로 완료되었습니다.',
      result: crawlResult,
      rawOutput: stdout.slice(-500),
    });
  } catch (error: any) {
    console.error('[API Crawl] Execution failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || '크롤러 실행 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

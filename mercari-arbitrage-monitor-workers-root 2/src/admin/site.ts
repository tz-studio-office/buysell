import { getDefaultRuntimeSettings } from '../config';
import {
  deleteCrawlTarget,
  fetchAdminSummary,
  listAllTargets,
  loadRuntimeSettings,
  toggleCrawlTarget,
  upsertCrawlTarget,
  upsertRuntimeSettings,
} from '../lib/supabase';
import type { CrawlTargetRow, Env, SourceName } from '../types/index';

function escapeHtml(value: string | number | boolean | null | undefined): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'scope';
}

function pageTemplate(title: string, body: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeHtml(title)}</title><style>:root{color-scheme:dark}body{font-family:Inter,system-ui,sans-serif;margin:0;background:#0b1020;color:#eef2ff}main{max-width:1280px;margin:0 auto;padding:24px}h1,h2,h3{margin:0 0 12px}.muted{color:#a5b4fc}.note{font-size:13px;line-height:1.6;color:#cbd5ff}.grid{display:grid;gap:16px}.grid-2{grid-template-columns:repeat(auto-fit,minmax(360px,1fr))}.grid-3{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}.card{background:#121933;border:1px solid #2b3565;border-radius:16px;padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.25)}input,select,textarea,button{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid #334155;background:#0f172a;color:#eef2ff;padding:10px 12px}button{cursor:pointer;background:#312e81;border-color:#4f46e5;font-weight:600}button.secondary{background:#1e293b}button.danger{background:#7f1d1d;border-color:#b91c1c}label{display:block;font-size:12px;color:#c7d2fe;margin-bottom:6px}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:12px}.table{width:100%;border-collapse:collapse}.table th,.table td{border-bottom:1px solid #28304e;padding:8px;text-align:left;vertical-align:top;font-size:13px}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#1f2a4d;color:#c7d2fe;font-size:12px}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions form{display:inline-block}.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px}.stat{background:#0f1730;border:1px solid #2a3562;border-radius:14px;padding:14px}.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}a{color:#93c5fd}.topbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:20px}.small{font-size:12px}.hr{border:0;border-top:1px solid #27315e;margin:16px 0}</style></head><body><main>${body}</main></body></html>`;
}

function loginPage(): Response {
  const html = pageTemplate(
    'Admin Login',
    `<div class="card" style="max-width:420px; margin:64px auto;"><h1>Admin Login</h1><p class="muted">RUN_TOKEN を入力して管理画面に入ります。</p><form method="post" action="/admin/login"><div class="row" style="grid-template-columns:1fr;"><div><label>RUN_TOKEN</label><input type="password" name="token" placeholder="RUN_TOKEN" required /></div></div><button type="submit">ログイン</button></form></div>`,
  );
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

function redirect(location: string, headers?: Headers): Response {
  const h = headers ?? new Headers();
  h.set('Location', location);
  return new Response(null, { status: 302, headers: h });
}

function getCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('cookie') ?? '';
  for (const pair of raw.split(';')) {
    const [k, ...rest] = pair.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

function isAdminAuthenticated(request: Request, env: Env): boolean {
  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? request.headers.get('x-run-token') ?? getCookie(request, 'admin_token');
  return token === env.RUN_TOKEN;
}

function navHtml(): string {
  return `<div class="topbar"><div><h1>Mercari Arbitrage Admin</h1><div class="muted">ファッション全体を先に集めて、DB側で整形・比較する前提の管理画面です。</div></div><div class="actions"><a href="/admin">Dashboard</a><a href="/admin/config">Config</a><a href="/admin/runbook">Runbook</a><form method="post" action="/admin/logout"><button class="secondary" type="submit">Logout</button></form></div></div>`;
}

function resolveTargetMode(target: CrawlTargetRow): string {
  const metadata = target.metadata ?? {};
  if (target.targetType === 'mercari_category') {
    return String(metadata.mode ?? (target.seedUrl ? 'list_url' : 'search_builder'));
  }
  return String(metadata.scopeType ?? 'listing_scope');
}

function targetRowHtml(target: CrawlTargetRow): string {
  const metadata = target.metadata ?? {};
  const detail = target.targetType === 'mercari_category'
    ? `<div><span class="pill">${escapeHtml(resolveTargetMode(target))}</span></div><div class="small" style="margin-top:6px">scope=${escapeHtml(String(metadata.scope ?? 'fashion'))}</div><div class="mono small" style="margin-top:6px">${escapeHtml(target.seedUrl ?? '')}</div>${target.categoryId || target.keyword ? `<div class="small muted" style="margin-top:6px">category_id=${escapeHtml(target.categoryId)} / keyword=${escapeHtml(target.keyword)}</div>` : ''}`
    : `<div><span class="pill">${escapeHtml(resolveTargetMode(target))}</span></div><div class="small" style="margin-top:6px">scope=${escapeHtml(String(metadata.scope ?? 'fashion'))}</div><div class="mono small" style="margin-top:6px">${escapeHtml(target.seedUrl ?? '')}</div>`;
  return `<tr><td><span class="pill">${escapeHtml(target.targetType)}</span></td><td>${escapeHtml(target.sourceName)}</td><td>${escapeHtml(target.label)}</td><td>${detail}</td><td>${escapeHtml(target.maxPages ?? '')}</td><td>${target.isActive ? 'ON' : 'OFF'}</td><td><div class="actions"><form method="post" action="/admin/targets/toggle"><input type="hidden" name="id" value="${escapeHtml(target.id)}" /><input type="hidden" name="is_active" value="${target.isActive ? 'false' : 'true'}" /><button class="secondary" type="submit">${target.isActive ? 'Disable' : 'Enable'}</button></form><form method="post" action="/admin/targets/delete" onsubmit="return confirm('Delete this target?')"><input type="hidden" name="id" value="${escapeHtml(target.id)}" /><button class="danger" type="submit">Delete</button></form></div></td></tr>`;
}

export async function renderAdminDashboard(env: Env): Promise<Response> {
  const [summary, targets] = await Promise.all([fetchAdminSummary(env), listAllTargets(env)]);
  const mercariTargets = targets.filter((t) => t.targetType === 'mercari_category');
  const supplierTargets = targets.filter((t) => t.targetType === 'supplier_seed');
  const html = pageTemplate(
    'Admin Dashboard',
    `${navHtml()}<div class="stats"><div class="stat"><div class="muted">取込設定数</div><h2>${summary.targetCount}</h2></div><div class="stat"><div class="muted">有効設定</div><h2>${summary.activeTargetCount}</h2></div><div class="stat"><div class="muted">本日の候補件数</div><h2>${summary.todayCandidateCount}</h2></div><div class="stat"><div class="muted">直近実行ログ</div><h2>${summary.recentRuns.length}</h2></div></div><div class="grid grid-3" style="margin-top:16px;"><section class="card"><h2>メルカリ側</h2><p class="note">ここは「ファッション売り切れ一覧をどこから取るか」を決める場所です。カテゴリを細かく手入力する前提ではなく、まず広く集めてからDB側で整える想定です。</p><h3 style="margin-top:16px">現在の設定</h3><table class="table"><thead><tr><th>label</th><th>detail</th><th>max</th><th>active</th></tr></thead><tbody>${mercariTargets.map((target) => `<tr><td>${escapeHtml(target.label)}</td><td class="mono small">${escapeHtml(target.seedUrl ?? '')}</td><td>${escapeHtml(target.maxPages ?? '')}</td><td>${target.isActive ? 'ON' : 'OFF'}</td></tr>`).join('') || '<tr><td colspan="4">No mercari import scopes</td></tr>'}</tbody></table></section><section class="card"><h2>仕入れ先側</h2><p class="note">ここはブランド別seedではなく、各サイトのファッション入口URLや大カテゴリURLを登録する場所です。収集後にブランド・サイズ・状態を整形して比較します。</p><h3 style="margin-top:16px">現在の設定</h3><table class="table"><thead><tr><th>source</th><th>label</th><th>detail</th><th>max</th></tr></thead><tbody>${supplierTargets.map((target) => `<tr><td>${escapeHtml(target.sourceName)}</td><td>${escapeHtml(target.label)}</td><td class="mono small">${escapeHtml(target.seedUrl ?? '')}</td><td>${escapeHtml(target.maxPages ?? '')}</td></tr>`).join('') || '<tr><td colspan="4">No supplier scopes</td></tr>'}</tbody></table></section><section class="card"><h2>最近の実行</h2><table class="table"><thead><tr><th>job</th><th>source</th><th>status</th><th>created</th></tr></thead><tbody>${(summary.recentRuns as any[]).map((row) => `<tr><td>${escapeHtml(row.job_name)}</td><td>${escapeHtml(row.source_name)}</td><td>${escapeHtml(row.status)}</td><td>${escapeHtml(row.created_at)}</td></tr>`).join('') || '<tr><td colspan="4">No runs yet</td></tr>'}</tbody></table></section></div><section class="card" style="margin-top:16px"><h2>登録済み取込設定一覧</h2><table class="table"><thead><tr><th>type</th><th>source</th><th>label</th><th>detail</th><th>max pages</th><th>active</th><th>actions</th></tr></thead><tbody>${targets.map(targetRowHtml).join('') || '<tr><td colspan="7">No targets</td></tr>'}</tbody></table></section>`,
  );
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function renderConfigPage(env: Env): Promise<Response> {
  const defaults = getDefaultRuntimeSettings(env);
  const [settings, targets] = await Promise.all([loadRuntimeSettings(env, defaults), listAllTargets(env)]);
  const mercariTargets = targets.filter((t) => t.targetType === 'mercari_category');
  const supplierTargets = targets.filter((t) => t.targetType === 'supplier_seed');

  const html = pageTemplate(
    'Config',
    `${navHtml()}<div class="grid grid-3"><section class="card"><h2>Runtime Settings</h2><form method="post" action="/admin/settings"><div class="row"><div><label>mercari_max_pages</label><input name="mercari_max_pages" value="${escapeHtml(settings.mercariMaxPages)}" /></div><div><label>supplier_max_pages</label><input name="supplier_max_pages" value="${escapeHtml(settings.supplierMaxPages)}" /></div></div><div class="row"><div><label>http_timeout_ms</label><input name="http_timeout_ms" value="${escapeHtml(settings.httpTimeoutMs)}" /></div><div><label>http_retry_count</label><input name="http_retry_count" value="${escapeHtml(settings.httpRetryCount)}" /></div></div><div class="row"><div><label>marketplace_fee_rate</label><input name="marketplace_fee_rate" value="${escapeHtml(settings.marketplaceFeeRate)}" /></div><div><label>default_shipping_cost_yen</label><input name="default_shipping_cost_yen" value="${escapeHtml(settings.defaultShippingCostYen)}" /></div></div><div class="row"><div><label>enable_detail_enrichment</label><select name="enable_detail_enrichment"><option value="true" ${settings.enableDetailEnrichment ? 'selected' : ''}>true</option><option value="false" ${settings.enableDetailEnrichment ? '' : 'selected'}>false</option></select></div><div><label>run_mercari_cron</label><input name="run_mercari_cron" value="${escapeHtml(settings.runMercariCron)}" /></div></div><div class="row"><div><label>run_suppliers_cron</label><input name="run_suppliers_cron" value="${escapeHtml(settings.runSuppliersCron)}" /></div><div><label>run_match_cron</label><input name="run_match_cron" value="${escapeHtml(settings.runMatchCron)}" /></div></div><button type="submit">Save Settings</button></form><div class="hr"></div><p class="note">ここは巡回件数・タイムアウト・粗利計算の前提だけを置きます。メルカリの細かいカテゴリ登録はしません。</p></section><section class="card"><h2>メルカリ取込設定</h2><p class="note">メルカリは「ファッションの売り切れ一覧URL」や export/list の入口URL を1つ以上登録してください。取込後にDB側でカテゴリ・ブランド・サイズを整形します。</p><form method="post" action="/admin/targets/mercari/save"><div class="row"><div><label>label</label><input name="label" placeholder="メルカリ / ファッション売り切れ一覧" required /></div><div><label>scope</label><select name="scope"><option value="fashion">fashion</option><option value="mens">mens</option><option value="ladies">ladies</option><option value="custom">custom</option></select></div></div><div class="row" style="grid-template-columns:1fr;"><div><label>list_url</label><textarea name="seed_url" rows="3" placeholder="ファッション一覧または売り切れ一覧URL。必要なら {page} を含めてください。" required></textarea></div></div><div class="row"><div><label>max_pages</label><input name="max_pages" placeholder="5" /></div><div><label>sort_order</label><input name="sort_order" value="100" /></div></div><details style="margin-bottom:12px"><summary class="small muted" style="cursor:pointer">Advanced (必要な時だけ)</summary><div class="row" style="margin-top:12px"><div><label>category_id</label><input name="category_id" placeholder="必要な時だけ" /></div><div><label>keyword</label><input name="keyword" placeholder="必要な時だけ" /></div></div></details><button type="submit">Add Mercari Import Scope</button></form><div class="hr"></div><table class="table"><thead><tr><th>label</th><th>scope</th><th>list url</th><th>max</th><th>active</th></tr></thead><tbody>${mercariTargets.map((target) => `<tr><td>${escapeHtml(target.label)}</td><td>${escapeHtml(String(target.metadata?.scope ?? 'fashion'))}</td><td class="mono small">${escapeHtml(target.seedUrl ?? '')}</td><td>${escapeHtml(target.maxPages ?? '')}</td><td>${target.isActive ? 'ON' : 'OFF'}</td></tr>`).join('') || '<tr><td colspan="5">No mercari import scopes</td></tr>'}</tbody></table></section><section class="card"><h2>仕入れサイト scope URL 追加</h2><p class="note">ここはブランド別ではなく、各サイトのファッション入口URL・メンズ一覧・レディース一覧など「広い入口」を登録してください。</p><form method="post" action="/admin/targets/supplier/save"><div class="row"><div><label>source</label><select name="source_name"><option value="secondstreet">secondstreet</option><option value="buzzstore">buzzstore</option><option value="offmoll">offmoll</option></select></div><div><label>label</label><input name="label" placeholder="セカスト / ファッション一覧" required /></div></div><div class="row"><div><label>scope</label><select name="scope"><option value="fashion">fashion</option><option value="mens">mens</option><option value="ladies">ladies</option><option value="brand_used">brand_used</option><option value="custom">custom</option></select></div><div><label>max_pages</label><input name="max_pages" placeholder="5" /></div></div><div class="row" style="grid-template-columns:1fr;"><div><label>entry_url</label><textarea name="seed_url" rows="3" placeholder="そのサイトのファッション一覧URL。必要なら {page} を含めてください。" required></textarea></div></div><div class="row"><div><label>sort_order</label><input name="sort_order" value="100" /></div><div></div></div><button type="submit">Add Supplier Scope</button></form><div class="hr"></div><table class="table"><thead><tr><th>source</th><th>label</th><th>scope</th><th>entry url</th><th>max</th><th>active</th></tr></thead><tbody>${supplierTargets.map((target) => `<tr><td>${escapeHtml(target.sourceName)}</td><td>${escapeHtml(target.label)}</td><td>${escapeHtml(String(target.metadata?.scope ?? 'fashion'))}</td><td class="mono small">${escapeHtml(target.seedUrl ?? '')}</td><td>${escapeHtml(target.maxPages ?? '')}</td><td>${target.isActive ? 'ON' : 'OFF'}</td></tr>`).join('') || '<tr><td colspan="6">No supplier scopes</td></tr>'}</tbody></table></section></div>`,
  );

  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function renderRunbookPage(): Promise<Response> {
  const html = pageTemplate(
    'Runbook',
    `${navHtml()}<section class="card"><h2>Runbook</h2><ol><li>Supabase に完全版SQLを実行する</li><li>Cloudflare に <code>SUPABASE_URL</code>, <code>SUPABASE_SERVICE_ROLE_KEY</code>, <code>RUN_TOKEN</code> を設定する</li><li>/admin/config で「メルカリのファッション売り切れ一覧URL」と「各仕入れサイトのファッション入口URL」を登録する</li><li><code>POST /tasks/full-sync?token=...</code> で初回同期する</li><li>候補確認は Supabase の <code>profitable_candidates_v</code> を使う</li></ol><p class="note">今回の設計は、先に広く取得してから DB 側でカテゴリ・ブランド・サイズ・状態を整える運用です。メルカリを細かいブランド単位で毎回登録する前提ではありません。</p></section>`,
  );
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export async function handleAdminRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/admin/login' && request.method === 'POST') {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    if (token !== env.RUN_TOKEN) return new Response('Invalid token', { status: 401 });
    const headers = new Headers();
    headers.set('Set-Cookie', `admin_token=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
    return redirect('/admin', headers);
  }
  if (url.pathname === '/admin/logout' && request.method === 'POST') {
    const headers = new Headers();
    headers.set('Set-Cookie', 'admin_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
    return redirect('/admin', headers);
  }
  if (!isAdminAuthenticated(request, env)) return loginPage();
  if (url.pathname === '/admin' && request.method === 'GET') return renderAdminDashboard(env);
  if (url.pathname === '/admin/config' && request.method === 'GET') return renderConfigPage(env);
  if (url.pathname === '/admin/runbook' && request.method === 'GET') return renderRunbookPage();
  if (url.pathname === '/admin/settings' && request.method === 'POST') {
    const form = await request.formData();
    await upsertRuntimeSettings(env, {
      mercari_max_pages: String(form.get('mercari_max_pages') ?? ''),
      supplier_max_pages: String(form.get('supplier_max_pages') ?? ''),
      http_timeout_ms: String(form.get('http_timeout_ms') ?? ''),
      http_retry_count: String(form.get('http_retry_count') ?? ''),
      marketplace_fee_rate: String(form.get('marketplace_fee_rate') ?? ''),
      default_shipping_cost_yen: String(form.get('default_shipping_cost_yen') ?? ''),
      enable_detail_enrichment: String(form.get('enable_detail_enrichment') ?? ''),
      run_mercari_cron: String(form.get('run_mercari_cron') ?? ''),
      run_suppliers_cron: String(form.get('run_suppliers_cron') ?? ''),
      run_match_cron: String(form.get('run_match_cron') ?? ''),
    });
    return redirect('/admin/config');
  }
  if (url.pathname === '/admin/targets/mercari/save' && request.method === 'POST') {
    const form = await request.formData();
    const label = String(form.get('label') ?? '').trim();
    const seedUrl = String(form.get('seed_url') ?? '').trim();
    const scope = String(form.get('scope') ?? 'fashion').trim();
    await upsertCrawlTarget(env, {
      targetType: 'mercari_category',
      sourceName: 'mercari',
      targetKey: `mercari_${slugify(label)}`,
      label,
      categoryId: String(form.get('category_id') ?? '').trim() || null,
      keyword: String(form.get('keyword') ?? '').trim() || null,
      seedUrl: seedUrl || null,
      maxPages: Number(form.get('max_pages') ?? '') || null,
      sortOrder: Number(form.get('sort_order') ?? '') || 100,
      isActive: true,
      metadata: {
        scope,
        mode: seedUrl ? 'list_url' : 'search_builder',
        normalizeAfterImport: true,
      },
    });
    return redirect('/admin/config');
  }
  if (url.pathname === '/admin/targets/supplier/save' && request.method === 'POST') {
    const form = await request.formData();
    const sourceName = String(form.get('source_name') ?? 'secondstreet').trim() as SourceName;
    const label = String(form.get('label') ?? '').trim();
    const scope = String(form.get('scope') ?? 'fashion').trim();
    await upsertCrawlTarget(env, {
      targetType: 'supplier_seed',
      sourceName,
      targetKey: `${sourceName}_${slugify(label)}`,
      label,
      seedUrl: String(form.get('seed_url') ?? '').trim(),
      maxPages: Number(form.get('max_pages') ?? '') || null,
      sortOrder: Number(form.get('sort_order') ?? '') || 100,
      isActive: true,
      metadata: {
        scope,
        scopeType: 'listing_scope',
        normalizeAfterImport: true,
      },
    });
    return redirect('/admin/config');
  }
  if (url.pathname === '/admin/targets/toggle' && request.method === 'POST') {
    const form = await request.formData();
    await toggleCrawlTarget(env, String(form.get('id') ?? ''), String(form.get('is_active') ?? '') === 'true');
    return redirect('/admin');
  }
  if (url.pathname === '/admin/targets/delete' && request.method === 'POST') {
    const form = await request.formData();
    await deleteCrawlTarget(env, String(form.get('id') ?? ''));
    return redirect('/admin');
  }
  return new Response('Not Found', { status: 404 });
}

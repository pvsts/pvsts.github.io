<template>
  <div class="container">
    <header class="room-header">
      <div class="room-card">
        <div class="room-info-group">
          <span class="room-sub-label">正在使用房间</span>
          <h2 class="room-id">{{ roomId }}</h2>
        </div>
      </div>
    </header>

    <div class="control-panel">
      <div class="panel-left">
        <div class="sync-status">
          <span :class="['indicator', isReady ? 'online' : 'syncing']"></span>
          <span class="status-text">{{ currentStatus }}</span>
          <span v-if="timeLeft" class="count-down">⏳ {{ timeLeft }}</span>
        </div>
        <div class="divider hide-mobile"></div>
        <button @click="handleShareClick" class="btn-action share-btn">
          <span class="icon">📱</span> <span>扫码分享</span>
          <span v-if="copySuccess" class="copy-toast">已复制!</span>
        </button>
      </div>

      <div class="panel-right">
        <template v-if="!isLocked">
          <div class="expire-zone">
            <div v-if="!showTimeOptions" class="time-display" @click="showTimeOptions = true">
              <span class="label">自毁:</span>
              <span class="current-option">{{ getExpireText }} ⚙️</span>
            </div>
            
            <div v-else class="seg-control-wrapper">
              <div class="seg-control animate-in">
                <button v-for="opt in ['never', '1h', '24h', '3d', '7d']" 
                        :key="opt"
                        :class="{ active: expireOption === opt }" 
                        @click="selectExpire(opt)">
                  {{ opt === 'never' ? '永不' : opt }}
                </button>
                <button :class="{ active: expireOption === 'custom' }" @click="expireOption = 'custom'">自定义</button>
                <button class="btn-close-mini" @click="showTimeOptions = false">✕</button>
              </div>
            </div>
          </div>

          <div class="divider hide-mobile"></div>

          <div class="lock-zone-new">
            <template v-if="!dbPassword">
              <div class="pw-group">
                <input v-model="newPassword" type="password" placeholder="设置密码" class="pw-input-mini" />
                <button @click="lockRoom" class="btn-lock-mini">锁定</button>
              </div>
            </template>
            <template v-else>
              <button @click="unlockRoomPermanently" class="btn-unlock-pill">🔒 解除锁定</button>
            </template>
          </div>
        </template>
        <template v-else>
          <span class="lock-hint-text">身份验证中...</span>
        </template>
      </div>
    </div>

    <div v-if="showQR" class="modal-overlay" @click="showQR = false">
      <div class="modal-card" @click.stop>
        <h3>扫码同步至手机</h3>
        <qrcode-vue :value="currentUrl" :size="180" level="H" class="qr-code" />
        <p class="qr-room-id">房间号: {{ roomId }}</p>
        <p class="qr-hint">链接已自动复制，可直接粘贴分享</p>
        <button @click="showQR = false" class="btn-close">确定</button>
      </div>
    </div>

    <main class="editor-frame">
      <div v-if="isLocked" class="state-overlay lock-layer">
        <div class="state-card auth-card">
          <div class="state-icon-wrap">🔐</div>
          <h3>该频道已锁定</h3>
          <p class="auth-hint">请输入访问密码以查看内容</p>
          <div class="auth-form">
            <input v-model="inputPassword" type="password" @keyup.enter="verifyPassword" placeholder="请输入密码" autofocus />
            <button @click="verifyPassword" class="btn-main">解锁并进入</button>
          </div>
        </div>
      </div>

      <div v-else-if="isExpired" class="state-overlay expire-layer">
        <div class="state-card">
          <div class="state-icon">💨</div>
          <h3>内容已销毁</h3>
          <button @click="resetRoom" class="btn-main">重新创建</button>
        </div>
      </div>

      <textarea
        v-else
        v-model="textContent"
        @input="handleInput"
        @focus="userActive = true"
        @blur="userActive = false"
        placeholder="在此输入内容，多人实时同步..."
        spellcheck="false"
      ></textarea>
    </main>

    <footer class="footer-tips">
      💡 提示：在 URL 后面拼接 <code>?room=任意名字</code> 即可自由切换频道。
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { supabase } from './supabase'
import QrcodeVue from 'qrcode.vue'

// --- 状态数据 ---
const textContent = ref('')
const currentStatus = ref('连接中...')
const isReady = ref(false)
const userActive = ref(false)
const showQR = ref(false)
const showTimeOptions = ref(false)
const copySuccess = ref(false)
const currentUrl = window.location.href

const urlParams = new URLSearchParams(window.location.search)
const roomId = urlParams.get('room') || '公共频道'
const isLocked = ref(false)
const isExpired = ref(false)
const dbPassword = ref('')
const inputPassword = ref('')
const newPassword = ref('')

const expireOption = ref('never')
const timeLeft = ref('')
const customTimeInput = ref('')
const minDateTime = new Date().toISOString().slice(0, 16)

const getExpireText = computed(() => {
  const map = { never: '永不销毁', '1h': '1小时后', '24h': '24小时后', '3d': '3天后', '7d': '7天后', 'custom': '自定义' }
  return map[expireOption.value] || '自定义'
})

let syncTimer = null
let clockTimer = null
let channel = null

// --- 逻辑函数 ---
const handleShareClick = () => {
  showQR.value = true
  navigator.clipboard.writeText(currentUrl).then(() => {
    copySuccess.value = true
    setTimeout(() => copySuccess.value = false, 2000)
  })
}

const selectExpire = (type) => {
  if (type === 'custom') {
    expireOption.value = 'custom'
    return 
  }
  updateExpireMode(type)
  showTimeOptions.value = false
}

const handleCustomTimeChange = async () => {
  if (!customTimeInput.value) return
  const expiry = new Date(customTimeInput.value).toISOString()
  await supabase.from('clipboards').update({ expires_at: expiry }).eq('id', roomId)
  startCountdown(expiry)
  showTimeOptions.value = false
}

const updateExpireMode = async (type) => {
  expireOption.value = type
  clearInterval(clockTimer); timeLeft.value = ''
  let expiresAt = null
  const now = Date.now()
  if (type === '1h') expiresAt = new Date(now + 3600000).toISOString()
  else if (type === '24h') expiresAt = new Date(now + 24 * 3600000).toISOString()
  else if (type === '3d') expiresAt = new Date(now + 72 * 3600000).toISOString()
  else if (type === '7d') expiresAt = new Date(now + 168 * 3600000).toISOString()
  
  await supabase.from('clipboards').update({ expires_at: expiresAt }).eq('id', roomId)
  if (expiresAt) startCountdown(expiresAt)
}

const startCountdown = (expiry) => {
  if (clockTimer) clearInterval(clockTimer)
  const calc = () => {
    const diff = new Date(expiry) - new Date()
    if (diff <= 0) triggerDestroy()
    else {
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      timeLeft.value = h > 0 ? `${h}h ${m}m` : `${m}m`
    }
  }
  calc(); clockTimer = setInterval(calc, 30000)
}

const triggerDestroy = async () => {
  isExpired.value = true
  await supabase.from('clipboards').update({ content: '', expires_at: null, password: null }).eq('id', roomId)
}

const handleInput = () => {
  isReady.value = false; currentStatus.value = '同步中...'
  clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    await supabase.from('clipboards').upsert({ id: roomId, content: textContent.value })
    isReady.value = true; currentStatus.value = '就绪'
  }, 800)
}

const verifyPassword = () => {
  if (inputPassword.value === dbPassword.value) {
    sessionStorage.setItem(`unlock_${roomId}`, 'true')
    isLocked.value = false; init()
  } else alert('密码错误')
}

const lockRoom = async () => {
  if (!newPassword.value) return
  await supabase.from('clipboards').update({ password: newPassword.value }).eq('id', roomId)
  dbPassword.value = newPassword.value
  sessionStorage.setItem(`unlock_${roomId}`, 'true')
  newPassword.value = ''
}

const unlockRoomPermanently = async () => {
  if(!confirm('确定解除锁定？')) return
  await supabase.from('clipboards').update({ password: null }).eq('id', roomId)
  dbPassword.value = null; sessionStorage.removeItem(`unlock_${roomId}`)
}

const init = async () => {
  const { data } = await supabase.from('clipboards').select('*').eq('id', roomId).maybeSingle()
  if (data) {
    if (data.expires_at) {
      const expiryDate = new Date(data.expires_at)
      if (expiryDate < new Date()) return triggerDestroy()
      startCountdown(data.expires_at)
      const diffHours = (expiryDate - new Date()) / 3600000
      if (diffHours <= 1.1) expireOption.value = '1h'
      else if (diffHours <= 24.1) expireOption.value = '24h'
      else if (diffHours <= 72.1) expireOption.value = '3d'
      else if (diffHours <= 168.1) expireOption.value = '7d'
      else expireOption.value = 'custom'
    }
    dbPassword.value = data.password
    if (dbPassword.value && !sessionStorage.getItem(`unlock_${roomId}`)) {
      isLocked.value = true; currentStatus.value = '待解锁'
    } else {
      textContent.value = data.content || ''; isReady.value = true; currentStatus.value = '就绪'
    }
  } else {
    await supabase.from('clipboards').insert({ id: roomId, content: '' }); isReady.value = true
  }
}

const resetRoom = () => { isExpired.value = false; init(); }

onMounted(() => {
  init()
  channel = supabase.channel(`live-${roomId}`).on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'clipboards', filter: `id=eq.${roomId}` }, 
    (payload) => {
      if (!userActive.value && !isLocked.value) {
        textContent.value = payload.new.content
        if (payload.new.expires_at) startCountdown(payload.new.expires_at)
      }
    }).subscribe()
})

onUnmounted(() => { clearInterval(clockTimer); if (channel) supabase.removeChannel(channel); })
</script>

<style scoped>
/* 1. 基础布局 */
.container { max-width: 1000px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; padding: 12px; box-sizing: border-box; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }

/* 头部 */
.room-header { padding-bottom: 12px; }
.room-card { background: #1e293b; color: white; padding: 12px 20px; border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); display: inline-flex; flex-direction: column; }
.room-sub-label { font-size: 10px; opacity: 0.6; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
.room-id { margin: 0; font-size: 20px; font-weight: 900; }

/* 2. 控制面板 */
.control-panel { 
  background: white; padding: 8px 16px; border-radius: 12px; margin-bottom: 12px; 
  display: flex; justify-content: space-between; align-items: center; 
  border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.panel-left, .panel-right { display: flex; align-items: center; gap: 15px; }
.divider { width: 1px; height: 20px; background: #e2e8f0; }

/* 扫码分享按钮增强 */
.btn-action { 
  background: #f8fafc; border: 1px solid #cbd5e1; padding: 6px 14px; 
  border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; color: #334155; 
  display: flex; align-items: center; gap: 6px; transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  white-space: nowrap;
}
.btn-action:hover { background: white; border-color: #3b82f6; color: #3b82f6; transform: translateY(-1px); box-shadow: 0 4px 6px rgba(0,0,0,0.05); }

/* 自毁区域对齐修复 */
.expire-zone { display: flex; align-items: center; }
.time-display { 
  display: flex; align-items: center; gap: 5px; cursor: pointer; padding: 6px 8px; 
  border-radius: 6px; white-space: nowrap; transition: background 0.2s;
}
.time-display:hover { background: #f1f5f9; }
.label { font-size: 13px; color: #64748b; font-weight: 600; }
.current-option { font-size: 13px; font-weight: 800; color: #2563eb; }

/* 密码区域修复 */
.lock-zone-new { display: flex; align-items: center; }
.pw-group { display: flex; align-items: center; gap: 6px; }
.pw-input-mini { 
  border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; outline: none; 
  font-size: 13px; width: 100px; transition: border-color 0.2s;
}
.pw-input-mini:focus { border-color: #3b82f6; }
.btn-lock-mini { 
  background: #3b82f6; color: white; border: none; padding: 6px 12px; 
  border-radius: 6px; font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap;
}

/* 3. 手机端适配：重点重构 */
@media (max-width: 768px) {
  .control-panel { 
    flex-direction: column; align-items: stretch; gap: 12px; padding: 12px;
  }
  .panel-left, .panel-right { 
    justify-content: space-between; width: 100%; 
  }
  .hide-mobile { display: none; }
  
  /* 确保手机端文字不换行 */
  .status-text, .current-option, .btn-action, .label { white-space: nowrap !important; }

  /* 解决密码框过长 */
  .pw-group { flex: 1; justify-content: flex-end; }
  .pw-input-mini { width: 40% !important; max-width: 120px; }
}

/* 4. 辅助 UI */
.sync-status { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #475569; }
.indicator { width: 8px; height: 8px; border-radius: 50%; }
.online { background: #10b981; box-shadow: 0 0 8px rgba(16,185,129,0.4); }
.syncing { background: #f59e0b; animation: blink 1s infinite; }
@keyframes blink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }

.count-down { color: #e11d48; background: #fff1f2; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 800; }

.seg-control { display: flex; background: #f1f5f9; padding: 2px; border-radius: 8px; gap: 2px; overflow-x: auto; }
.seg-control button { border: none; padding: 6px 10px; border-radius: 6px; font-size: 12px; cursor: pointer; background: transparent; white-space: nowrap; font-weight: 600; color: #64748b; }
.seg-control button.active { background: white; color: #2563eb; font-weight: 800; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }

.btn-unlock-pill { background: #fff1f2; color: #e11d48; border: 1px solid #fecaca; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 800; cursor: pointer; }

/* 5. 编辑器 */
.editor-frame { flex: 1; position: relative; background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.01); }
textarea { 
  width: 100%; height: 100%; padding: 20px; border: none; outline: none; 
  font-size: 16px; line-height: 1.7; resize: none; box-sizing: border-box; 
  color: #1e293b; background: transparent;
}

/* 6. 弹窗与遮罩 */
.modal-overlay { position: fixed; inset: 0; background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
.modal-card { background: white; padding: 30px; border-radius: 20px; text-align: center; width: 100%; max-width: 320px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
.qr-code { margin: 20px auto; border: 1px solid #f1f5f9; padding: 10px; border-radius: 12px; }

.state-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; z-index: 100; backdrop-filter: blur(8px); background: rgba(255,255,255,0.8); }
.state-card { background: white; padding: 40px; border-radius: 24px; text-align: center; box-shadow: 0 10px 40px rgba(0,0,0,0.08); width: 85%; max-width: 360px; }

.btn-main { width: 100%; background: #1e293b; color: white; border: none; padding: 16px; border-radius: 12px; font-weight: 800; cursor: pointer; transition: background 0.2s; }
.btn-main:hover { background: #0f172a; }

.footer-tips { padding: 12px 0; text-align: center; font-size: 12px; color: #94a3b8; font-weight: 500; }
.animate-in { animation: fadeInUp 0.3s ease-out; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>
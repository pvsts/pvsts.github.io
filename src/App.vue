<template>
  <div class="container" :class="{ 'dark-mode': isDarkMode }">
    <!-- 顶部导航栏 -->
    <header class="top-nav">
      <div class="nav-left">
        <h1 class="logo">云剪贴板</h1>
        <div class="room-badge" @click="handleShareClick">
          <span class="room-label">房间:</span>
          <span class="room-name">{{ roomId }}</span>
          <span class="copy-icon">📋</span>
        </div>
      </div>
      <div class="nav-right">
        <button @click="toggleHistory" class="icon-btn" title="历史记录">
          <span>📜</span>
        </button>
        <button @click="toggleDarkMode" class="icon-btn" :title="isDarkMode ? '切换亮色模式' : '切换暗黑模式'">
          <span>{{ isDarkMode ? '☀️' : '🌙' }}</span>
        </button>
        <button @click="toggleSettings" class="icon-btn" title="设置">
          <span>⚙️</span>
        </button>
      </div>
    </header>

    <!-- 设置面板遮罩 -->
    <div v-if="showSettings" class="panel-overlay" @click="toggleSettings"></div>

    <!-- 设置面板（侧边栏） -->
    <aside v-if="showSettings" class="settings-panel animate-slide-in">
      <div class="panel-header">
        <h3>⚙️ 房间设置</h3>
        <button @click="toggleSettings" class="close-btn">✕</button>
      </div>

      <!-- 密码保护 -->
      <div class="setting-section">
        <h4>🔒 密码保护</h4>
        <template v-if="!dbPassword">
          <div class="input-group">
            <input
              v-model="newPassword"
              type="password"
              placeholder="设置访问密码"
              class="setting-input"
              @input="checkPasswordStrength"
            />
            <button @click="lockRoom" class="btn-primary" :disabled="!newPassword">设置密码</button>
          </div>
          <div v-if="newPassword" class="password-strength">
            <div class="strength-bar">
              <div class="strength-fill" :style="{ width: passwordStrength + '%', background: strengthColor }"></div>
            </div>
            <span class="strength-text">{{ strengthText }}</span>
          </div>
        </template>
        <template v-else>
          <p class="status-text">✅ 已设置密码保护</p>
          <button @click="confirmUnlockRoom" class="btn-danger">移除密码</button>
        </template>
      </div>

      <!-- 过期时间 -->
      <div class="setting-section">
        <h4>⏰ 自动销毁</h4>
        <div class="time-options">
          <button v-for="opt in expireOptions"
                  :key="opt.value"
                  :class="{ active: expireOption === opt.value }"
                  @click="selectExpire(opt.value)">
            {{ opt.label }}
          </button>
        </div>
        <div v-if="expireOption !== 'never'" class="countdown-display">
          <span>⏱️ 剩余时间: {{ timeLeft || '计算中...' }}</span>
        </div>
      </div>

      <!-- 自定义时间 -->
      <div class="setting-section" v-if="expireOption === 'custom'">
        <h4>📅 自定义销毁时间</h4>
        <div class="input-group">
          <input type="datetime-local" v-model="customTimeInput" :min="minDateTime" class="setting-input" />
          <button @click="handleCustomTimeChange" class="btn-primary">确定</button>
        </div>
      </div>

      <!-- 分享 -->
      <div class="setting-section">
        <h4>📱 分享房间</h4>
        <button @click="handleShareClick" class="btn-primary full-width">
          生成二维码/链接
        </button>
      </div>
    </aside>

    <!-- 历史记录面板 -->
    <div v-if="showHistory" class="panel-overlay" @click="toggleHistory"></div>
    <aside v-if="showHistory" class="history-panel animate-slide-in">
      <div class="panel-header">
        <h3>📜 历史记录</h3>
        <button @click="toggleHistory" class="close-btn">✕</button>
      </div>
      <div class="history-content">
        <div v-if="roomHistory.length === 0" class="empty-history">
          <span class="empty-icon">📝</span>
          <p>暂无历史记录</p>
        </div>
        <div v-else class="history-list">
          <div
            v-for="(room, index) in roomHistory"
            :key="index"
            class="history-item"
            @click="switchRoom(room.name)"
          >
            <div class="history-item-left">
              <span class="history-icon">🏠</span>
              <div class="history-info">
                <span class="history-name">{{ room.name }}</span>
                <span class="history-time">{{ formatHistoryTime(room.timestamp) }}</span>
              </div>
            </div>
            <button @click.stop="removeFromHistory(index)" class="history-delete">×</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- Toast 通知 -->
    <div class="toast-container">
      <transition-group name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="toast" :class="toast.type">
          <span class="toast-icon">{{ toast.icon }}</span>
          <span class="toast-message">{{ toast.message }}</span>
          <button @click="removeToast(toast.id)" class="toast-close">×</button>
        </div>
      </transition-group>
    </div>

    <!-- 二维码弹窗 -->
    <div v-if="showQR" class="modal-overlay" @click="closeQRModal">
      <div class="modal-card animate-in" @click.stop>
        <button @click="closeQRModal" class="modal-close">✕</button>
        <h3>扫码分享</h3>
        <div class="qr-wrapper">
          <qrcode-vue :value="currentUrl" :size="200" level="H" class="qr-code" />
        </div>
        <p class="room-url">{{ currentUrl }}</p>
        <button @click="copyLink" class="btn-primary full-width" style="margin-top: 12px;">
          {{ copySuccess ? '✓ 已复制' : '📋 复制链接' }}
        </button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 状态指示条 -->
      <div class="status-bar">
        <div class="status-indicator">
          <span :class="['dot', isReady ? 'online' : 'syncing']"></span>
          <span class="status-label">{{ currentStatus }}</span>
        </div>
        <div class="status-info">
          <div v-if="timeLeft" class="expiry-badge">
            <span>🕐 {{ timeLeft }}</span>
          </div>
          <div class="stats-badge">
            <span>{{ textStats.chars }} 字</span>
            <span class="divider">|</span>
            <span>{{ textStats.lines }} 行</span>
          </div>
        </div>
      </div>

      <!-- 编辑器容器 -->
      <div class="editor-container">
        <!-- 锁定遮罩 -->
        <div v-if="isLocked" class="lock-overlay">
          <div class="lock-card">
            <div class="lock-icon">🔐</div>
            <h2>私密房间</h2>
            <p>请输入密码访问此内容</p>
            <input
              v-model="inputPassword"
              type="password"
              @keyup.enter="verifyPassword"
              placeholder="访问密码"
              class="password-input"
              autofocus
            />
            <button @click="verifyPassword" class="btn-primary btn-large">
              验证并进入
            </button>
          </div>
        </div>

        <!-- 已过期遮罩 -->
        <div v-else-if="isExpired" class="lock-overlay">
          <div class="lock-card">
            <div class="lock-icon">💨</div>
            <h2>内容已销毁</h2>
            <p>此房间的内容已自动清除</p>
            <button @click="confirmResetRoom" class="btn-primary btn-large">
              重新创建
            </button>
          </div>
        </div>

        <!-- 主编辑器 -->
        <textarea
          v-model="textContent"
          @input="handleInput"
          placeholder="在此输入内容，多设备实时同步..."
          class="main-textarea"
          spellcheck="false"
        ></textarea>
      </div>

      <!-- 底部提示 -->
      <footer class="footer">
        <p>💡 提示：在 URL 后添加 <code>?room=任意名称</code> 即可切换频道</p>
        <p class="shortcuts-hint">快捷键: Ctrl+S 保存 | Esc 关闭弹窗</p>
      </footer>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { supabase } from './supabase'
import QrcodeVue from 'qrcode.vue'

// --- 状态数据 ---
const textContent = ref('')
const currentStatus = ref('连接中...')
const isReady = ref(false)
const showQR = ref(false)
const showSettings = ref(false)
const showHistory = ref(false)
const copySuccess = ref(false)
const currentUrl = window.location.href
const isLoading = ref(true)
const isDarkMode = ref(false)

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

// 过期时间选项
const expireOptions = [
  { value: 'never', label: '永不' },
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '3天', label: '3天' },
  { value: '7天', label: '7天' },
  { value: '1年', label: '1年' },
  { value: '2年', label: '2年' },
  { value: '3年', label: '3年' }
]

// 历史记录
const roomHistory = ref([])

// Toast 通知
const toasts = ref([])
let toastId = 0

// 密码强度
const passwordStrength = ref(0)
const strengthColor = ref('#dc3545')
const strengthText = ref('')

// 文本统计
const textStats = computed(() => {
  const chars = textContent.value.length
  const lines = textContent.value.split('\n').length
  return { chars, lines }
})

let syncTimer = null
let clockTimer = null
let channel = null
let retryCount = 0
const maxRetries = 3

// --- 生命周期 ---
onMounted(() => {
  // 加载本地缓存
  loadFromLocalStorage()
  // 加载主题
  loadTheme()
  // 初始化
  init()
  // 监听快捷键
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  clearInterval(clockTimer)
  if (channel) supabase.removeChannel(channel)
  document.removeEventListener('keydown', handleKeydown)
})

// 监听文本变化，保存到本地缓存
watch(textContent, (newContent) => {
  localStorage.setItem(`cache_${roomId}`, newContent)
})

// 监听主题变化
watch(isDarkMode, (newValue) => {
  localStorage.setItem('darkMode', newValue.toString())
})

// --- 工具函数 ---
const showToast = (message, type = 'info') => {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }
  const id = ++toastId
  toasts.value.push({ id, message, type, icon: icons[type] })
  setTimeout(() => removeToast(id), 3000)
}

const removeToast = (id) => {
  toasts.value = toasts.value.filter(t => t.id !== id)
}

const loadTheme = () => {
  const savedTheme = localStorage.getItem('darkMode')
  if (savedTheme !== null) {
    isDarkMode.value = savedTheme === 'true'
  } else {
    isDarkMode.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
}

const loadFromLocalStorage = () => {
  const cache = localStorage.getItem(`cache_${roomId}`)
  if (cache) {
    textContent.value = cache
  }
  const history = localStorage.getItem('roomHistory')
  if (history) {
    roomHistory.value = JSON.parse(history)
  }
}

const saveToHistory = () => {
  if (roomHistory.value.length === 0 || roomHistory.value[0].name !== roomId) {
    roomHistory.value = roomHistory.value.filter(r => r.name !== roomId)
    roomHistory.value.unshift({ name: roomId, timestamp: Date.now() })
    if (roomHistory.value.length > 10) roomHistory.value.pop()
    localStorage.setItem('roomHistory', JSON.stringify(roomHistory.value))
  }
}

const formatHistoryTime = (timestamp) => {
  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return new Date(timestamp).toLocaleDateString()
}

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value
  showToast(isDarkMode.value ? '已切换到暗黑模式' : '已切换到亮色模式', 'info')
}

const toggleSettings = () => {
  showSettings.value = !showSettings.value
}

const toggleHistory = () => {
  showHistory.value = !showHistory.value
}

const checkPasswordStrength = () => {
  const password = newPassword.value
  let strength = 0
  if (password.length >= 8) strength += 25
  if (password.length >= 12) strength += 25
  if (/[A-Z]/.test(password)) strength += 25
  if (/[0-9]/.test(password)) strength += 25

  passwordStrength.value = strength
  if (strength <= 25) {
    strengthColor.value = '#dc3545'
    strengthText.value = '弱'
  } else if (strength <= 50) {
    strengthColor.value = '#ffc107'
    strengthText.value = '中'
  } else if (strength <= 75) {
    strengthColor.value = '#0dcaf0'
    strengthText.value = '强'
  } else {
    strengthColor.value = '#198754'
    strengthText.value = '很强'
  }
}

const handleKeydown = (e) => {
  // Ctrl/Cmd + S 保存
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault()
    handleManualSave()
  }
  // Esc 关闭弹窗
  if (e.key === 'Escape') {
    if (showQR.value) showQR.value = false
    if (showSettings.value) showSettings.value = false
    if (showHistory.value) showHistory.value = false
  }
}

// --- 核心功能 ---
const handleShareClick = () => {
  showQR.value = true
  copySuccess.value = false
  navigator.clipboard.writeText(currentUrl).then(() => {
    showToast('链接已复制到剪贴板', 'success')
    copySuccess.value = true
  })
}

const closeQRModal = () => {
  showQR.value = false
  copySuccess.value = false
}

const copyLink = () => {
  navigator.clipboard.writeText(currentUrl).then(() => {
    showToast('链接已复制到剪贴板', 'success')
    copySuccess.value = true
  })
}

const selectExpire = (type) => {
  if (type === 'custom') {
    expireOption.value = 'custom'
    return
  }
  updateExpireMode(type)
}

const handleCustomTimeChange = async () => {
  if (!customTimeInput.value) return
  const expiry = new Date(customTimeInput.value).toISOString()
  startCountdown(expiry)
  await supabase.from('clipboards').update({ expires_at: expiry }).eq('id', roomId)
  showToast('自定义销毁时间已设置', 'success')
}

const updateExpireMode = async (type) => {
  expireOption.value = type
  clearInterval(clockTimer)
  timeLeft.value = ''
  let expiresAt = null
  const now = Date.now()
  const timeMap = {
    '1h': 3600000,
    '24h': 24 * 3600000,
    '3天': 3 * 24 * 3600000,
    '7天': 7 * 24 * 3600000,
    '1年': 365 * 24 * 3600000,
    '2年': 730 * 24 * 3600000,
    '3年': 1095 * 24 * 3600000
  }

  if (timeMap[type]) {
    expiresAt = new Date(now + timeMap[type]).toISOString()
  }

  await supabase.from('clipboards').update({ expires_at: expiresAt }).eq('id', roomId)
  if (expiresAt) startCountdown(expiresAt)
  showToast('销毁时间已更新', 'success')
}

const startCountdown = (expiry) => {
  if (clockTimer) clearInterval(clockTimer)
  const calc = () => {
    const diff = new Date(expiry) - new Date()
    if (diff <= 0) triggerDestroy()
    else {
      const days = Math.floor(diff / (24 * 3600000))
      const hours = Math.floor((diff % (24 * 3600000)) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)

      if (days > 0) {
        timeLeft.value = `${days}天 ${hours}时`
      } else if (hours > 0) {
        timeLeft.value = `${hours}时 ${minutes}分`
      } else {
        timeLeft.value = `${minutes}分`
      }
    }
  }
  calc()
  clockTimer = setInterval(calc, 30000)
}

const triggerDestroy = async () => {
  isExpired.value = true
  await supabase.from('clipboards').update({ content: '', expires_at: null, password: null }).eq('id', roomId)
  showToast('内容已自动销毁', 'warning')
}

const getDebounceTime = () => {
  // 根据文本长度动态调整防抖时间
  const length = textContent.value.length
  if (length < 100) return 500
  if (length < 500) return 800
  if (length < 1000) return 1200
  return 1500
}

const handleManualSave = async () => {
  currentStatus.value = '手动保存中...'
  try {
    await supabase.from('clipboards').upsert({ id: roomId, content: textContent.value })
    currentStatus.value = '已保存'
    showToast('内容已保存', 'success')
    setTimeout(() => {
      if (isReady.value) currentStatus.value = '就绪'
    }, 2000)
  } catch (error) {
    currentStatus.value = '保存失败'
    showToast('保存失败，请重试', 'error')
  }
}

const handleInput = () => {
  isReady.value = false
  currentStatus.value = '同步中...'
  clearTimeout(syncTimer)
  syncTimer = setTimeout(async () => {
    await saveToDatabase()
  }, getDebounceTime())
}

const saveToDatabase = async () => {
  try {
    await supabase.from('clipboards').upsert({ id: roomId, content: textContent.value })
    isReady.value = true
    currentStatus.value = '就绪'
    retryCount = 0
  } catch (error) {
    console.error('保存失败:', error)
    if (retryCount < maxRetries) {
      retryCount++
      currentStatus.value = `重试中 (${retryCount}/${maxRetries})...`
      setTimeout(saveToDatabase, 2000 * retryCount)
    } else {
      currentStatus.value = '同步失败'
      showToast('同步失败，请检查网络连接', 'error')
    }
  }
}

const verifyPassword = () => {
  if (inputPassword.value === dbPassword.value) {
    sessionStorage.setItem(`unlock_${roomId}`, 'true')
    isLocked.value = false
    showToast('密码验证成功', 'success')
    init()
  } else {
    showToast('密码错误，请重试', 'error')
    inputPassword.value = ''
  }
}

const lockRoom = async () => {
  if (!newPassword.value) return
  await supabase.from('clipboards').update({ password: newPassword.value }).eq('id', roomId)
  dbPassword.value = newPassword.value
  sessionStorage.setItem(`unlock_${roomId}`, 'true')
  newPassword.value = ''
  passwordStrength.value = 0
  showToast('密码已设置', 'success')
}

const confirmUnlockRoom = () => {
  if (confirm('确定要移除密码保护吗？移除后任何人都可以访问此房间。')) {
    unlockRoomPermanently()
  }
}

const unlockRoomPermanently = async () => {
  await supabase.from('clipboards').update({ password: null }).eq('id', roomId)
  dbPassword.value = null
  sessionStorage.removeItem(`unlock_${roomId}`)
  showToast('密码已移除', 'success')
}

const confirmResetRoom = () => {
  if (confirm('确定要重新创建房间吗？此操作将清除所有数据。')) {
    resetRoom()
  }
}

const resetRoom = async () => {
  isExpired.value = false
  await supabase.from('clipboards').update({ content: '', expires_at: null, password: null }).eq('id', roomId)
  textContent.value = ''
  timeLeft.value = ''
  expireOption.value = 'never'
  dbPassword.value = null
  sessionStorage.removeItem(`unlock_${roomId}`)
  await init()
  showToast('房间已重新创建', 'success')
}

const switchRoom = (roomName) => {
  const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomName)}`
  window.location.href = newUrl
}

const removeFromHistory = (index) => {
  roomHistory.value.splice(index, 1)
  localStorage.setItem('roomHistory', JSON.stringify(roomHistory.value))
}

const init = async () => {
  isLoading.value = true
  try {
    const { data, error } = await supabase.from('clipboards').select('*').eq('id', roomId).maybeSingle()

    if (error) throw error

    if (data) {
      if (data.expires_at) {
        const expiryDate = new Date(data.expires_at)
        if (expiryDate < new Date()) return triggerDestroy()
        startCountdown(data.expires_at)
        const diffHours = (expiryDate - new Date()) / 3600000
        const timeThresholds = [
          { limit: 1.1, value: '1h' },
          { limit: 24.1, value: '24h' },
          { limit: 72.1, value: '3天' },
          { limit: 168.1, value: '7天' },
          { limit: 8760.1, value: '1年' },
          { limit: 17520.1, value: '2年' },
          { limit: 26280.1, value: '3年' }
        ]
        for (const threshold of timeThresholds) {
          if (diffHours <= threshold.limit) {
            expireOption.value = threshold.value
            break
          }
        }
        if (diffHours > 26280.1) expireOption.value = 'custom'
      }
      dbPassword.value = data.password
      if (dbPassword.value && !sessionStorage.getItem(`unlock_${roomId}`)) {
        isLocked.value = true
        currentStatus.value = '待解锁'
      } else {
        textContent.value = data.content || ''
        isReady.value = true
        currentStatus.value = '就绪'
      }
    } else {
      await supabase.from('clipboards').insert({ id: roomId, content: '' })
      isReady.value = true
      currentStatus.value = '就绪'
    }

    saveToHistory()
  } catch (error) {
    console.error('初始化失败:', error)
    showToast('连接失败，请检查网络', 'error')
    currentStatus.value = '连接失败'
  } finally {
    isLoading.value = false
  }
}

// 订阅实时更新
onMounted(() => {
  channel = supabase.channel(`live-${roomId}`).on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'clipboards', filter: `id=eq.${roomId}` },
    (payload) => {
      if (!isLocked.value && payload.new.content !== textContent.value) {
        textContent.value = payload.new.content
        if (payload.new.expires_at) startCountdown(payload.new.expires_at)
        showToast('内容已同步', 'info')
      }
    }).subscribe()
})
</script>

<style scoped>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

/* 主容器 */
.container {
  min-height: 100vh;
  background-color: #f8f9fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  display: flex;
  flex-direction: column;
  transition: background-color 0.3s;
}

.container.dark-mode {
  background-color: #1a1a2e;
  color: #e0e0e0;
}

/* 顶部导航 */
.top-nav {
  background: white;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #e9ecef;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  transition: all 0.3s;
}

.dark-mode .top-nav {
  background: #16213e;
  border-bottom-color: #0f3460;
}

.nav-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: #212529;
  margin: 0;
}

.dark-mode .logo {
  color: #e0e0e0;
}

.room-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.dark-mode .room-badge {
  background: #0f3460;
  border-color: #16213e;
  color: #e0e0e0;
}

.room-badge:hover {
  background: #e9ecef;
  border-color: #adb5bd;
  transform: translateY(-1px);
}

.dark-mode .room-badge:hover {
  background: #1a1a2e;
}

.room-label {
  font-size: 13px;
  color: #6c757d;
}

.dark-mode .room-label {
  color: #a0a0a0;
}

.room-name {
  font-size: 14px;
  font-weight: 600;
  color: #212529;
}

.dark-mode .room-name {
  color: #e0e0e0;
}

.copy-icon {
  font-size: 14px;
  opacity: 0.6;
}

.nav-right {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #f8f9fa;
  transform: scale(1.1);
}

.dark-mode .icon-btn:hover {
  background: #1a1a2e;
}

/* 面板遮罩 */
.panel-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  animation: fadeIn 0.2s ease-out;
}

/* 设置面板（侧边栏） */
.settings-panel {
  position: fixed;
  right: 0;
  top: 0;
  width: 320px;
  height: 100vh;
  background: white;
  box-shadow: -4px 0 12px rgba(0,0,0,0.15);
  z-index: 1000;
  overflow-y: auto;
  transition: all 0.3s;
}

.dark-mode .settings-panel {
  background: #16213e;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.dark-mode .panel-header {
  border-bottom-color: #0f3460;
}

.panel-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #212529;
}

.dark-mode .panel-header h3 {
  color: #e0e0e0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 4px 8px;
  line-height: 1;
  transition: all 0.2s;
}

.close-btn:hover {
  color: #212529;
  background: #f8f9fa;
  border-radius: 4px;
  transform: rotate(90deg);
}

.dark-mode .close-btn:hover {
  color: #e0e0e0;
  background: #1a1a2e;
}

.setting-section {
  padding: 20px;
  border-bottom: 1px solid #e9ecef;
}

.dark-mode .setting-section {
  border-bottom-color: #0f3460;
}

.setting-section h4 {
  margin: 0 0 16px;
  font-size: 14px;
  font-weight: 600;
  color: #495057;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.dark-mode .setting-section h4 {
  color: #a0a0a0;
}

.input-group {
  display: flex;
  gap: 8px;
}

.setting-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  background: white;
  color: #212529;
}

.dark-mode .setting-input {
  background: #0f3460;
  border-color: #16213e;
  color: #e0e0e0;
}

.setting-input:focus {
  border-color: #228be6;
  box-shadow: 0 0 0 3px rgba(34, 139, 230, 0.1);
}

.password-strength {
  margin-top: 12px;
}

.strength-bar {
  height: 4px;
  background: #e9ecef;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 6px;
}

.strength-fill {
  height: 100%;
  transition: all 0.3s;
}

.strength-text {
  font-size: 12px;
  color: #6c757d;
}

.dark-mode .strength-text {
  color: #a0a0a0;
}

.time-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.time-options button {
  padding: 10px 8px;
  border: 1px solid #dee2e6;
  background: white;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #495057;
  cursor: pointer;
  transition: all 0.2s;
}

.dark-mode .time-options button {
  background: #0f3460;
  border-color: #16213e;
  color: #e0e0e0;
}

.time-options button:hover {
  background: #f8f9fa;
  border-color: #adb5bd;
  transform: translateY(-1px);
}

.dark-mode .time-options button:hover {
  background: #1a1a2e;
}

.time-options button.active {
  background: #228be6;
  color: white;
  border-color: #228be6;
  transform: scale(1.05);
}

.countdown-display {
  margin-top: 12px;
  padding: 10px;
  background: #fff3cd;
  border-left: 3px solid #ffc107;
  border-radius: 4px;
  font-size: 13px;
  color: #856404;
}

.dark-mode .countdown-display {
  background: #664d03;
  color: #ffecb5;
}

.status-text {
  font-size: 14px;
  color: #6c757d;
  margin: 12px 0;
}

.dark-mode .status-text {
  color: #a0a0a0;
}

/* 按钮样式 */
.btn-primary {
  padding: 10px 20px;
  background: #228be6;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  background: #1c7ed6;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(34, 139, 230, 0.3);
}

.btn-primary:disabled {
  background: #adb5bd;
  cursor: not-allowed;
  transform: none;
}

.btn-primary.full-width {
  width: 100%;
}

.btn-primary.btn-large {
  width: 100%;
  padding: 14px;
  font-size: 16px;
}

.btn-danger {
  padding: 10px 20px;
  background: #fa5252;
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: #e03131;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(250, 82, 82, 0.3);
}

/* 历史记录面板 */
.history-panel {
  position: fixed;
  left: 0;
  top: 0;
  width: 320px;
  height: 100vh;
  background: white;
  box-shadow: 4px 0 12px rgba(0,0,0,0.15);
  z-index: 1000;
  overflow-y: auto;
}

.dark-mode .history-panel {
  background: #16213e;
}

.history-content {
  padding: 16px;
}

.empty-history {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
}

.dark-mode .empty-history {
  color: #a0a0a0;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
  opacity: 0.5;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.dark-mode .history-item {
  background: #0f3460;
  border-color: #16213e;
}

.history-item:hover {
  background: #e9ecef;
  border-color: #228be6;
  transform: translateX(4px);
}

.dark-mode .history-item:hover {
  background: #1a1a2e;
}

.history-item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.history-icon {
  font-size: 20px;
}

.history-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.history-name {
  font-weight: 600;
  color: #212529;
}

.dark-mode .history-name {
  color: #e0e0e0;
}

.history-time {
  font-size: 12px;
  color: #6c757d;
}

.dark-mode .history-time {
  color: #a0a0a0;
}

.history-delete {
  background: none;
  border: none;
  color: #dc3545;
  font-size: 24px;
  cursor: pointer;
  padding: 4px 8px;
  line-height: 1;
  opacity: 0;
  transition: all 0.2s;
}

.history-item:hover .history-delete {
  opacity: 1;
}

.history-delete:hover {
  transform: scale(1.2);
}

/* Toast 通知 */
.toast-container {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 5000;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}

.toast-container > * {
  pointer-events: auto;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  min-width: 280px;
  animation: toastSlideIn 0.3s ease-out;
  border-left: 4px solid #228be6;
}

.toast.success {
  border-left-color: #40c057;
}

.toast.error {
  border-left-color: #fa5252;
}

.toast.warning {
  border-left-color: #fab005;
}

.dark-mode .toast {
  background: #16213e;
  color: #e0e0e0;
}

.toast-icon {
  font-size: 18px;
}

.toast-message {
  flex: 1;
  font-size: 14px;
}

.toast-close {
  background: none;
  border: none;
  color: #6c757d;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}

.toast-close:hover {
  color: #212529;
}

.dark-mode .toast-close:hover {
  color: #e0e0e0;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

@keyframes toastSlideIn {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 加载状态 */
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(255,255,255,0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.dark-mode .loading-overlay {
  background: rgba(26, 26, 46, 0.9);
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #e9ecef;
  border-top-color: #228be6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

.loading-overlay p {
  color: #6c757d;
  font-size: 16px;
}

.dark-mode .loading-overlay p {
  color: #a0a0a0;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* 主内容区域 */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

/* 状态栏 */
.status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  margin-bottom: 16px;
  border: 1px solid #e9ecef;
  flex-wrap: wrap;
  gap: 8px;
}

.dark-mode .status-bar {
  background: #16213e;
  border-color: #0f3460;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot.online {
  background: #40c057;
  box-shadow: 0 0 0 2px rgba(64, 192, 87, 0.2);
}

.dot.syncing {
  background: #fab005;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-label {
  font-size: 13px;
  color: #495057;
  font-weight: 500;
}

.dark-mode .status-label {
  color: #a0a0a0;
}

.status-info {
  display: flex;
  gap: 12px;
  align-items: center;
}

.expiry-badge {
  padding: 4px 12px;
  background: #fff3cd;
  border-radius: 20px;
  font-size: 13px;
  color: #856404;
  font-weight: 500;
}

.dark-mode .expiry-badge {
  background: #664d03;
  color: #ffecb5;
}

.stats-badge {
  padding: 4px 12px;
  background: #e7f5ff;
  border-radius: 20px;
  font-size: 13px;
  color: #1971c2;
  font-weight: 500;
  display: flex;
  gap: 8px;
  align-items: center;
}

.dark-mode .stats-badge {
  background: #1a365d;
  color: #74c0fc;
}

.stats-badge .divider {
  opacity: 0.5;
}

/* 编辑器容器 */
.editor-container {
  flex: 1;
  background: white;
  border-radius: 12px;
  border: 1px solid #e9ecef;
  overflow: hidden;
  position: relative;
  min-height: 500px;
  transition: all 0.3s;
}

.dark-mode .editor-container {
  background: #16213e;
  border-color: #0f3460;
}

.main-textarea {
  width: 100%;
  height: 100%;
  min-height: 500px;
  padding: 24px;
  border: none;
  outline: none;
  font-size: 16px;
  line-height: 1.8;
  resize: none;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: #212529;
  background: transparent;
}

.dark-mode .main-textarea {
  color: #e0e0e0;
}

.main-textarea::placeholder {
  color: #adb5bd;
}

.dark-mode .main-textarea::placeholder {
  color: #6c757d;
}

/* 空状态 */
.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  background: #f8f9fa;
}

.dark-mode .empty-state {
  background: #0f3460;
  color: #a0a0a0;
}

.empty-icon {
  font-size: 64px;
  margin-bottom: 20px;
  opacity: 0.5;
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.empty-state h3 {
  font-size: 24px;
  color: #495057;
  margin-bottom: 8px;
}

.dark-mode .empty-state h3 {
  color: #e0e0e0;
}

.empty-state p {
  font-size: 14px;
  margin-bottom: 24px;
  opacity: 0.8;
}

.empty-tips {
  display: flex;
  gap: 16px;
  font-size: 13px;
  opacity: 0.7;
}

/* 锁定遮罩 */
.lock-overlay {
  position: absolute;
  inset: 0;
  background: #f8f9fa;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dark-mode .lock-overlay {
  background: #0f3460;
}

.lock-card {
  text-align: center;
  padding: 40px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  max-width: 400px;
  width: 90%;
  animation: scaleIn 0.3s ease-out;
}

.dark-mode .lock-card {
  background: #16213e;
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.lock-icon {
  font-size: 64px;
  margin-bottom: 20px;
  animation: shake 2s ease-in-out infinite;
}

@keyframes shake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  75% { transform: rotate(5deg); }
}

.lock-card h2 {
  font-size: 24px;
  color: #212529;
  margin-bottom: 12px;
  font-weight: 600;
}

.dark-mode .lock-card h2 {
  color: #e0e0e0;
}

.lock-card p {
  color: #6c757d;
  font-size: 15px;
  margin-bottom: 24px;
}

.dark-mode .lock-card p {
  color: #a0a0a0;
}

.password-input {
  width: 100%;
  padding: 14px;
  border: 2px solid #e9ecef;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;
  outline: none;
  transition: all 0.2s;
  background: white;
  color: #212529;
}

.dark-mode .password-input {
  background: #0f3460;
  border-color: #16213e;
  color: #e0e0e0;
}

.password-input:focus {
  border-color: #228be6;
  box-shadow: 0 0 0 3px rgba(34, 139, 230, 0.1);
}

/* 底部 */
.footer {
  padding: 16px 0;
  text-align: center;
  color: #6c757d;
  font-size: 13px;
}

.dark-mode .footer {
  color: #a0a0a0;
}

.footer code {
  padding: 2px 6px;
  background: #e9ecef;
  border-radius: 4px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
  font-size: 12px;
}

.dark-mode .footer code {
  background: #0f3460;
  color: #e0e0e0;
}

.shortcuts-hint {
  margin-top: 8px;
  opacity: 0.7;
}

/* 二维码弹窗 */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
  padding: 20px;
  animation: fadeIn 0.2s ease-out;
}

.modal-card {
  background: white;
  padding: 32px;
  border-radius: 16px;
  text-align: center;
  width: 100%;
  max-width: 360px;
  position: relative;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}

.dark-mode .modal-card {
  background: #16213e;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #6c757d;
  padding: 4px;
  line-height: 1;
  transition: all 0.2s;
}

.modal-close:hover {
  color: #212529;
  background: #f8f9fa;
  border-radius: 4px;
  transform: rotate(90deg);
}

.dark-mode .modal-close:hover {
  color: #e0e0e0;
  background: #1a1a2e;
}

.modal-card h3 {
  margin: 0 0 20px;
  font-size: 20px;
  color: #212529;
  font-weight: 600;
}

.dark-mode .modal-card h3 {
  color: #e0e0e0;
}

.qr-wrapper {
  margin: 0 auto 20px;
  display: flex;
  justify-content: center;
}

.qr-code {
  border: 2px solid #e9ecef;
  border-radius: 12px;
  padding: 12px;
  transition: all 0.3s;
}

.qr-code:hover {
  transform: scale(1.05);
  box-shadow: 0 8px 24px rgba(0,0,0,0.15);
}

.room-url {
  font-size: 12px;
  color: #6c757d;
  word-break: break-all;
  margin-bottom: 8px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 6px;
}

.dark-mode .room-url {
  background: #0f3460;
  color: #a0a0a0;
}

/* 动画 */
.animate-in {
  animation: fadeInUp 0.3s ease-out;
}

.animate-slide-in {
  animation: slideInRight 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .top-nav {
    padding: 12px 16px;
  }

  .nav-left {
    gap: 12px;
  }

  .logo {
    font-size: 16px;
  }

  .room-badge {
    padding: 6px 12px;
  }

  .room-name {
    font-size: 13px;
  }

  .settings-panel,
  .history-panel {
    width: 100%;
  }

  .main-content {
    padding: 16px;
  }

  .status-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .status-info {
    width: 100%;
    justify-content: space-between;
  }

  .time-options {
    grid-template-columns: repeat(2, 1fr);
  }

  .editor-container {
    min-height: 400px;
  }

  .main-textarea {
    min-height: 400px;
    padding: 16px;
  }

  .lock-card {
    padding: 24px;
  }

  .toast-container {
    left: 10px;
    right: 10px;
    transform: none;
  }

  .toast {
    min-width: auto;
  }

  .empty-tips {
    flex-direction: column;
    gap: 8px;
  }
}
</style>

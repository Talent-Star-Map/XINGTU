<script>
export default {
  onLaunch: function () {
    console.log('App Launch')
    // ===== TEMP AnyService connectivity test (remove after verify) =====
    // #ifdef MP-WEIXIN
    const runAnyServiceHealthTest = async () => {
      const tag = '[AnyServiceTest]'
      const result = { initOk: false, callOk: false, statusCode: null, data: null, errCode: null, errMsg: null }
      try {
        wx.cloud.init({
          env: 'xingtu-d5g6yf2jy4a899a2e',
          traceUser: true
        })
        result.initOk = true
        console.log(tag, 'wx.cloud.init OK env=xingtu-d5g6yf2jy4a899a2e')
      } catch (e) {
        result.errCode = e && e.errCode
        result.errMsg = (e && e.errMsg) || (e && e.message) || String(e)
        console.error(tag, 'wx.cloud.init FAILED', 'errCode=', result.errCode, 'errMsg=', result.errMsg, e)
      }
      if (result.initOk) {
        try {
          const res = await wx.cloud.callContainer({
            path: '/api/health',
            method: 'GET',
            header: {
              'X-WX-SERVICE': 'tcbanyservice',
              'X-AnyService-Name': 'xingtu',
              'Content-Type': 'application/json'
            }
          })
          result.callOk = true
          result.statusCode = res && res.statusCode
          result.data = res && res.data
          console.log(tag, 'AnyService health result:', res)
          console.log(tag, 'statusCode=', result.statusCode, 'data=', JSON.stringify(result.data))
        } catch (e) {
          result.errCode = e && e.errCode
          result.errMsg = (e && e.errMsg) || (e && e.message) || String(e)
          console.error(tag, 'callContainer FAILED', 'errCode=', result.errCode, 'errMsg=', result.errMsg)
          console.error(tag, 'full error object:', e)
        }
      }
      console.log(tag, 'SUMMARY', JSON.stringify(result))
      uni.setStorageSync('anyServiceHealthTestResult', result)
    }
    runAnyServiceHealthTest()
    // #endif
    // ===== END TEMP AnyService connectivity test =====
  },
  onShow: function () {
    console.log('App Show')
  },
  onHide: function () {
    console.log('App Hide')
  },
}
</script>

<style>
/* 全局主题变量 — 通过 @import 从 theme.css 加载 */
@import './styles/theme.css';

/* 图标字体 */
@import './styles/iconfont.css';

/* ─── 全局基础样式（替代 Web 端 html, body, #root） ─── */
page {
  width: 100%;
  height: 100%;
  font-family: var(--font-body);
  background: var(--color-background);
  color: var(--color-on-surface);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  box-sizing: border-box;
}

/* uni-app H5 页面容器约束：防止 uni-page-body 成为滚动容器 */
uni-page-body {
  height: 100%;
  overflow: hidden;
}

/* 通配符重置（替代 Web 端 * { box-sizing: border-box }） */
view, text, scroll-view, swiper, input, textarea, button, image, video {
  box-sizing: border-box;
}
</style>

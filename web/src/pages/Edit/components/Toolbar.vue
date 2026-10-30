<template>
  <div class="toolbarContainer" :class="{ isDark: isDark }">
    <div class="toolbar" ref="toolbarRef" :class="{ 'siyuan-compact-toolbar': isSiyuanEmbedded, 'siyuan-toolbar-minimized': isSiyuanEmbedded && toolbarMinimized }">
      <!-- SiYuan only: compact toolbar. Reuse all original button handlers. -->
      <div v-if="isSiyuanEmbedded" v-show="!toolbarMinimized" class="toolbarBlock siyuan-compact-block">
        <!-- Every available node command is directly on the toolbar; on narrow
             windows only this icon strip scrolls, while file/format stay visible. -->
        <div class="siyuan-compact-tools" aria-label="节点功能工具栏">
          <ToolbarNodeBtnList :list="compactPrimaryList"></ToolbarNodeBtnList>
        </div>
        <!-- Group the file and format controls to eliminate inherited spacing
             from the popover reference wrapper and normal toolbar buttons. -->
        <div class="siyuan-compact-secondary" aria-label="文件与格式">
          <div class="siyuan-compact-file-control">
        <el-popover v-model="compactFileOpen" placement="bottom" width="150" trigger="click" popper-class="siyuan-compact-menu">
          <div class="siyuan-compact-file-actions">
            <button v-if="!isMobile" type="button" @click="compactFileOpen = false; openDirectory()">{{ $t('toolbar.directory') }}</button>
            <button v-if="!isMobile" type="button" @click="compactFileOpen = false; createNewLocalFile()">{{ $t('toolbar.newFile') }}</button>
            <button v-if="!isMobile" type="button" @click="compactFileOpen = false; openLocalFile()">{{ $t('toolbar.openFile') }}</button>
            <button v-if="!isMobile" type="button" @click="compactFileOpen = false; saveLocalFile()">{{ $t('toolbar.saveAs') }}</button>
            <button type="button" @click="compactFileOpen = false; $bus.$emit('showImport')">{{ $t('toolbar.import') }}</button>
            <button type="button" @click="compactFileOpen = false; $bus.$emit('showExport')">{{ $t('toolbar.export') }}</button>
          </div>
          <div slot="reference" class="toolbarBtn siyuan-compact-action" title="目录、新建、打开、另存为、导入和导出" role="button" tabindex="0" @keydown.enter="compactFileOpen = !compactFileOpen">
            <span class="icon iconfont iconwenjian1"></span><span class="text">文件</span>
          </div>
        </el-popover>
          </div>
        <div class="toolbarBtn siyuan-compact-action" :class="{ active: compactFormatOpen }" title="展开或收起文字格式工具" role="button" tabindex="0" @click="compactFormatOpen = !compactFormatOpen" @keydown.enter="compactFormatOpen = !compactFormatOpen">
          <span class="icon iconfont iconxingzhuang-wenzi"></span><span class="text">格式</span>
        </div>
        </div>
        <!-- Icon-only button: minimize the toolbar, not the mind-map block. -->
        <button type="button" class="siyuan-compact-toggle" title="最小化功能栏（思维导图仍可编辑）"
          aria-label="最小化功能栏" :aria-expanded="true" @mousedown.prevent @click.stop="minimizeToolbar">
          <span aria-hidden="true">−</span>
        </button>
        <!-- Keep Quill's existing controls mounted; reveal without re-creating them. -->
        <div class="siyuan-format-host" v-show="compactFormatOpen"></div>
        <!-- 本地文件树 -->
        <div
          class="fileTreeBox"
          v-if="fileTreeVisible"
          :class="{ expand: fileTreeExpand }"
        >
          <div class="fileTreeToolbar">
            <div class="fileTreeName">
              {{ rootDirName ? '/' + rootDirName : '' }}
            </div>
            <div class="fileTreeActionList">
              <div
                class="btn"
                :class="[
                  fileTreeExpand ? 'el-icon-arrow-up' : 'el-icon-arrow-down'
                ]"
                @click="fileTreeExpand = !fileTreeExpand"
              ></div>
              <div
                class="btn el-icon-close"
                @click="fileTreeVisible = false"
              ></div>
            </div>
          </div>
          <div class="fileTreeWrap">
            <el-tree
              :props="fileTreeProps"
              :load="loadFileTreeNode"
              :expand-on-click-node="false"
              node-key="id"
              lazy
            >
              <span class="customTreeNode" slot-scope="{ node, data }">
                <div class="treeNodeInfo">
                  <span
                    class="treeNodeIcon iconfont"
                    :class="[
                      data.type === 'file' ? 'iconwenjian' : 'icondakai'
                    ]"
                  ></span>
                  <span class="treeNodeName">{{ node.label }}</span>
                </div>
                <div class="treeNodeBtnList" v-if="data.type === 'file'">
                  <el-button
                    type="text"
                    size="mini"
                    v-if="data.enableEdit"
                    @click="editLocalFile(data)"
                    >编辑</el-button
                  >
                  <el-button
                    type="text"
                    size="mini"
                    v-else
                    @click="importLocalFile(data)"
                    >导入</el-button
                  >
                </div>
              </span>
            </el-tree>
          </div>
        </div>
      </div>

      <!-- Toolbar-only minimized state: keep the iframe and whiteboard intact. -->
      <button v-if="isSiyuanEmbedded" v-show="toolbarMinimized" type="button"
        class="siyuan-toolbar-restore" title="展开功能栏" aria-label="展开功能栏"
        :aria-expanded="false" @mousedown.prevent @click.stop="restoreToolbar"><span aria-hidden="true">☷</span></button>
      <!-- 节点操作：Standalone Web 版维持原布局 -->
      <div class="toolbarBlock" v-if="!isSiyuanEmbedded">
        <ToolbarNodeBtnList :list="horizontalList"></ToolbarNodeBtnList>
        <!-- 更多 -->
        <el-popover
          v-model="popoverShow"
          placement="bottom-end"
          width="120"
          trigger="hover"
          v-if="showMoreBtn"
          :style="{ marginLeft: horizontalList.length > 0 ? '20px' : 0 }"
        >
          <ToolbarNodeBtnList
            dir="v"
            :list="verticalList"
            @click.native="popoverShow = false"
          ></ToolbarNodeBtnList>
          <div slot="reference" class="toolbarBtn">
            <span class="icon iconfont icongongshi"></span>
            <span class="text">{{ $t('toolbar.more') }}</span>
          </div>
        </el-popover>
      </div>
      <!-- 导出：Standalone Web 版维持原布局 -->
      <div class="toolbarBlock" v-if="!isSiyuanEmbedded">
        <div class="toolbarBtn" @click="openDirectory" v-if="!isMobile">
          <span class="icon iconfont icondakai"></span>
          <span class="text">{{ $t('toolbar.directory') }}</span>
        </div>
        <el-tooltip
          effect="dark"
          :content="$t('toolbar.newFileTip')"
          placement="bottom"
          v-if="!isMobile"
        >
          <div class="toolbarBtn" @click="createNewLocalFile">
            <span class="icon iconfont iconxinjian"></span>
            <span class="text">{{ $t('toolbar.newFile') }}</span>
          </div>
        </el-tooltip>
        <el-tooltip
          effect="dark"
          :content="$t('toolbar.openFileTip')"
          placement="bottom"
          v-if="!isMobile"
        >
          <div class="toolbarBtn" @click="openLocalFile">
            <span class="icon iconfont iconwenjian1"></span>
            <span class="text">{{ $t('toolbar.openFile') }}</span>
          </div>
        </el-tooltip>
        <div class="toolbarBtn" @click="saveLocalFile" v-if="!isMobile">
          <span class="icon iconfont iconlingcunwei"></span>
          <span class="text">{{ $t('toolbar.saveAs') }}</span>
        </div>
        <div class="toolbarBtn" @click="$bus.$emit('showImport')">
          <span class="icon iconfont icondaoru"></span>
          <span class="text">{{ $t('toolbar.import') }}</span>
        </div>
        <div
          class="toolbarBtn"
          @click="$bus.$emit('showExport')"
          style="margin-right: 0;"
        >
          <span class="icon iconfont iconexport"></span>
          <span class="text">{{ $t('toolbar.export') }}</span>
        </div>
        <!-- 本地文件树 -->
        <div
          class="fileTreeBox"
          v-if="fileTreeVisible"
          :class="{ expand: fileTreeExpand }"
        >
          <div class="fileTreeToolbar">
            <div class="fileTreeName">
              {{ rootDirName ? '/' + rootDirName : '' }}
            </div>
            <div class="fileTreeActionList">
              <div
                class="btn"
                :class="[
                  fileTreeExpand ? 'el-icon-arrow-up' : 'el-icon-arrow-down'
                ]"
                @click="fileTreeExpand = !fileTreeExpand"
              ></div>
              <div
                class="btn el-icon-close"
                @click="fileTreeVisible = false"
              ></div>
            </div>
          </div>
          <div class="fileTreeWrap">
            <el-tree
              :props="fileTreeProps"
              :load="loadFileTreeNode"
              :expand-on-click-node="false"
              node-key="id"
              lazy
            >
              <span class="customTreeNode" slot-scope="{ node, data }">
                <div class="treeNodeInfo">
                  <span
                    class="treeNodeIcon iconfont"
                    :class="[
                      data.type === 'file' ? 'iconwenjian' : 'icondakai'
                    ]"
                  ></span>
                  <span class="treeNodeName">{{ node.label }}</span>
                </div>
                <div class="treeNodeBtnList" v-if="data.type === 'file'">
                  <el-button
                    type="text"
                    size="mini"
                    v-if="data.enableEdit"
                    @click="editLocalFile(data)"
                    >编辑</el-button
                  >
                  <el-button
                    type="text"
                    size="mini"
                    v-else
                    @click="importLocalFile(data)"
                    >导入</el-button
                  >
                </div>
              </span>
            </el-tree>
          </div>
        </div>
      </div>
    </div>
    <NodeImage></NodeImage>
    <NodeHyperlink></NodeHyperlink>
    <NodeIcon></NodeIcon>
    <NodeNote></NodeNote>
    <NodeTag></NodeTag>
    <Export></Export>
    <Import ref="ImportRef"></Import>
  </div>
</template>

<script>
import NodeImage from './NodeImage.vue'
import NodeHyperlink from './NodeHyperlink.vue'
import NodeIcon from './NodeIcon.vue'
import NodeNote from './NodeNote.vue'
import NodeTag from './NodeTag.vue'
import Export from './Export.vue'
import Import from './Import.vue'
import { mapState } from 'vuex'
import { Notification } from 'element-ui'
import exampleData from 'simple-mind-map/example/exampleData'
import { getData } from '../../../api'
import ToolbarNodeBtnList from './ToolbarNodeBtnList.vue'
import { throttle, isMobile } from 'simple-mind-map/src/utils/index'

// 工具栏
let fileHandle = null
const defaultBtnList = [
  'back',
  'forward',
  'painter',
  'siblingNode',
  'childNode',
  'deleteNode',
  'image',
  'icon',
  'link',
  'note',
  'tag',
  'summary',
  'associativeLine',
  'formula',
  // 'attachment',
  'outerFrame',
  'annotation',
  'ai'
]

export default {
  components: {
    NodeImage,
    NodeHyperlink,
    NodeIcon,
    NodeNote,
    NodeTag,
    Export,
    Import,
    ToolbarNodeBtnList
  },
  data() {
    return {
      isMobile: isMobile(),
      isSiyuanEmbedded: !!window.takeOverApp,
      compactPrimaryList: [],
      compactFileOpen: false,
      compactFormatOpen: false,
      // Embedded SiYuan maps start with the toolbar folded; standalone stays expanded.
      toolbarMinimized: !!window.takeOverApp,
      horizontalList: [],
      verticalList: [],
      showMoreBtn: true,
      popoverShow: false,
      fileTreeProps: {
        label: 'name',
        children: 'children',
        isLeaf: 'leaf'
      },
      fileTreeVisible: false,
      rootDirName: '',
      fileTreeExpand: true,
      waitingWriteToLocalFile: false
    }
  },
  computed: {
    ...mapState({
      isDark: state => state.localConfig.isDark,
      isHandleLocalFile: state => state.isHandleLocalFile,
      openNodeRichText: state => state.localConfig.openNodeRichText,
      enableAi: state => state.localConfig.enableAi
    }),

    btnLit() {
      let res = [...defaultBtnList]
      if (!this.openNodeRichText) {
        res = res.filter(item => {
          return item !== 'formula'
        })
      }
      if (!this.enableAi) {
        res = res.filter(item => {
          return item !== 'ai'
        })
      }
      return res
    }
  },
  watch: {
    isHandleLocalFile(val) {
      if (!val) {
        Notification.closeAll()
      }
    },
    btnLit: {
      deep: true,
      handler() {
        this.computeToolbarShow()
      }
    }
  },
  created() {
    this.$bus.$on('write_local_file', this.onWriteLocalFile)
  },
  mounted() {
    this.computeToolbarShow()
    this.computeToolbarShowThrottle = throttle(this.computeToolbarShow, 300)
    window.addEventListener('resize', this.computeToolbarShowThrottle)
    this.$bus.$on('lang_change', this.computeToolbarShowThrottle)
    window.addEventListener('beforeunload', this.onUnload)
    this.$bus.$on('node_note_dblclick', this.onNodeNoteDblclick)

  },
  beforeDestroy() {
    this.$bus.$off('write_local_file', this.onWriteLocalFile)
    window.removeEventListener('resize', this.computeToolbarShowThrottle)
    this.$bus.$off('lang_change', this.computeToolbarShowThrottle)
    window.removeEventListener('beforeunload', this.onUnload)
    this.$bus.$off('node_note_dblclick', this.onNodeNoteDblclick)

  },
  methods: {
    minimizeToolbar() {
      // Keep the toolbar and rich text components mounted, only hide their UI.
      // Closing popup state prevents floating menus from remaining visible.
      this.compactFileOpen = false
      this.compactFormatOpen = false
      this.toolbarMinimized = true
    },
    restoreToolbar() {
      this.toolbarMinimized = false
      this.$nextTick(() => this.computeToolbarShow())
    },
    // 计算工具按钮如何显示
    computeToolbarShow() {
      if (!this.$refs.toolbarRef) return
      if (this.isSiyuanEmbedded) {
        // Keep all real node commands visible. The icon strip can scroll
        // horizontally in narrow embedded maps, instead of hiding buttons in
        // a second popover or growing the toolbar vertically.
        const preferred = [
          'back', 'forward', 'siblingNode', 'childNode', 'deleteNode',
          'image', 'link', 'note', 'painter', 'icon'
        ]
        const ordered = [
          ...preferred.filter(item => this.btnLit.includes(item)),
          ...this.btnLit.filter(item => !preferred.includes(item))
        ]
        // ToolbarNodeBtnList has no renderer for the legacy 'annotation' id.
        this.compactPrimaryList = ordered.filter(item => item !== 'annotation')
        return
      }
      const windowWidth = window.innerWidth - 40
      const all = [...this.btnLit]
      let index = 1
      const loopCheck = () => {
        if (index > all.length) return done()
        this.horizontalList = all.slice(0, index)
        this.$nextTick(() => {
          const width = this.$refs.toolbarRef.getBoundingClientRect().width
          if (width < windowWidth) {
            index++
            loopCheck()
          } else if (index > 0 && width > windowWidth) {
            index--
            this.horizontalList = all.slice(0, index)
            done()
          }
        })
      }
      const done = () => {
        this.verticalList = all.slice(index)
        this.showMoreBtn = this.verticalList.length > 0
      }
      loopCheck()
    },

    // 监听本地文件读写
    onWriteLocalFile(content) {
      clearTimeout(this.timer)
      if (fileHandle && this.isHandleLocalFile) {
        this.waitingWriteToLocalFile = true
      }
      this.timer = setTimeout(() => {
        this.writeLocalFile(content)
      }, 1000)
    },

    onUnload(e) {
      if (this.waitingWriteToLocalFile) {
        const msg = '存在未保存的数据'
        e.returnValue = msg
        return msg
      }
    },

    // 加载本地文件树
    async loadFileTreeNode(node, resolve) {
      try {
        let dirHandle
        if (node.level === 0) {
          dirHandle = await window.showDirectoryPicker()
          this.rootDirName = dirHandle.name
        } else {
          dirHandle = node.data.handle
        }
        const dirList = []
        const fileList = []
        for await (const [key, value] of dirHandle.entries()) {
          const isFile = value.kind === 'file'
          if (isFile && !/\.(smm|xmind|md|json)$/.test(value.name)) {
            continue
          }
          const enableEdit = isFile && /\.smm$/.test(value.name)
          const data = {
            id: key,
            name: value.name,
            type: value.kind,
            handle: value,
            leaf: isFile,
            enableEdit
          }
          if (isFile) {
            fileList.push(data)
          } else {
            dirList.push(data)
          }
        }
        resolve([...dirList, ...fileList])
      } catch (error) {
        console.log(error)
        this.fileTreeVisible = false
        resolve([])
        if (error.toString().includes('aborted')) {
          return
        }
        this.$message.warning(this.$t('toolbar.notSupportTip'))
      }
    },

    // 扫描本地文件夹
    openDirectory() {
      this.fileTreeVisible = false
      this.fileTreeExpand = true
      this.rootDirName = ''
      this.$nextTick(() => {
        this.fileTreeVisible = true
      })
    },

    // 编辑指定文件
    editLocalFile(data) {
      if (data.handle) {
        fileHandle = data.handle
        this.readFile()
      }
    },

    // 导入指定文件
    async importLocalFile(data) {
      try {
        const file = await data.handle.getFile()
        this.$refs.ImportRef.onChange({
          raw: file,
          name: file.name
        })
        this.$refs.ImportRef.confirm()
      } catch (error) {
        console.log(error)
      }
    },

    // 打开本地文件
    async openLocalFile() {
      try {
        let [_fileHandle] = await window.showOpenFilePicker({
          types: [
            {
              description: '',
              accept: {
                'application/json': ['.smm']
              }
            }
          ],
          excludeAcceptAllOption: true,
          multiple: false
        })
        if (!_fileHandle) {
          return
        }
        fileHandle = _fileHandle
        if (fileHandle.kind === 'directory') {
          this.$message.warning(this.$t('toolbar.selectFileTip'))
          return
        }
        this.readFile()
      } catch (error) {
        console.log(error)
        if (error.toString().includes('aborted')) {
          return
        }
        this.$message.warning(this.$t('toolbar.notSupportTip'))
      }
    },

    // 读取本地文件
    async readFile() {
      let file = await fileHandle.getFile()
      let fileReader = new FileReader()
      fileReader.onload = async () => {
        this.$store.commit('setIsHandleLocalFile', true)
        this.setData(fileReader.result)
        Notification.closeAll()
        Notification({
          title: this.$t('toolbar.tip'),
          message: `${this.$t('toolbar.editingLocalFileTipFront')}${
            file.name
          }${this.$t('toolbar.editingLocalFileTipEnd')}`,
          duration: 0,
          showClose: true
        })
      }
      fileReader.readAsText(file)
    },

    // 渲染读取的数据
    setData(str) {
      try {
        let data = JSON.parse(str)
        if (typeof data !== 'object') {
          throw new Error(this.$t('toolbar.fileContentError'))
        }
        if (data.root) {
          this.isFullDataFile = true
        } else {
          this.isFullDataFile = false
          data = {
            ...exampleData,
            root: data
          }
        }
        this.$bus.$emit('setData', data)
      } catch (error) {
        console.log(error)
        this.$message.error(this.$t('toolbar.fileOpenFailed'))
      }
    },

    // 写入本地文件
    async writeLocalFile(content) {
      if (!fileHandle || !this.isHandleLocalFile) {
        this.waitingWriteToLocalFile = false
        return
      }
      if (!this.isFullDataFile) {
        content = content.root
      }
      let string = JSON.stringify(content)
      const writable = await fileHandle.createWritable()
      await writable.write(string)
      await writable.close()
      this.waitingWriteToLocalFile = false
    },

    // 创建本地文件
    async createNewLocalFile() {
      await this.createLocalFile(exampleData)
    },

    // 另存为
    async saveLocalFile() {
      let data = getData()
      await this.createLocalFile(data)
    },

    // 创建本地文件
    async createLocalFile(content) {
      try {
        let _fileHandle = await window.showSaveFilePicker({
          types: [
            {
              description: '',
              accept: { 'application/json': ['.smm'] }
            }
          ],
          suggestedName: this.$t('toolbar.defaultFileName')
        })
        if (!_fileHandle) {
          return
        }
        const loading = this.$loading({
          lock: true,
          text: this.$t('toolbar.creatingTip'),
          spinner: 'el-icon-loading',
          background: 'rgba(0, 0, 0, 0.7)'
        })
        fileHandle = _fileHandle
        this.$store.commit('setIsHandleLocalFile', true)
        this.isFullDataFile = true
        await this.writeLocalFile(content)
        await this.readFile()
        loading.close()
      } catch (error) {
        console.log(error)
        if (error.toString().includes('aborted')) {
          return
        }
        this.$message.warning(this.$t('toolbar.notSupportTip'))
      }
    },

    onNodeNoteDblclick(node, e) {
      e.stopPropagation()
      this.$bus.$emit('showNodeNote', node)
    }
  }
}
</script>

<style lang="less" scoped>
.toolbarContainer {
  &.isDark {
    .toolbar {
      color: hsla(0, 0%, 100%, 0.9);
      .toolbarBlock {
        background-color: #262a2e;

        .fileTreeBox {
          background-color: #262a2e;

          /deep/ .el-tree {
            background-color: #262a2e;

            &.el-tree--highlight-current {
              .el-tree-node.is-current > .el-tree-node__content {
                background-color: hsla(0, 0%, 100%, 0.05) !important;
              }
            }

            .el-tree-node:focus > .el-tree-node__content {
              background-color: hsla(0, 0%, 100%, 0.05) !important;
            }

            .el-tree-node__content:hover,
            .el-upload-list__item:hover {
              background-color: hsla(0, 0%, 100%, 0.02) !important;
            }
          }

          .fileTreeWrap {
            .customTreeNode {
              .treeNodeInfo {
                color: #fff;
              }

              .treeNodeBtnList {
                .el-button {
                  padding: 7px 5px;
                }
              }
            }
          }
        }
      }

      .toolbarBtn {
        .icon {
          background: transparent;
          border-color: transparent;
        }

        &:hover {
          &:not(.disabled) {
            .icon {
              background: hsla(0, 0%, 100%, 0.05);
            }
          }
        }

        &.disabled {
          color: #54595f;
        }
      }
    }
  }
  .toolbar {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    top: 20px;
    width: max-content;
    display: flex;
    font-size: 12px;
    font-family: PingFangSC-Regular, PingFang SC;
    font-weight: 400;
    color: rgba(26, 26, 26, 0.8);
    z-index: 2;

    .toolbarBlock {
      display: flex;
      background-color: #fff;
      padding: 10px 20px;
      border-radius: 6px;
      box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);
      border: 1px solid rgba(0, 0, 0, 0.06);
      margin-right: 20px;
      flex-shrink: 0;
      position: relative;

      &:last-of-type {
        margin-right: 0;
      }

      .fileTreeBox {
        position: absolute;
        left: 0;
        top: 68px;
        width: 100%;
        height: 30px;
        background-color: #fff;
        padding: 12px 5px;
        padding-top: 0;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border-radius: 5px;
        min-width: 200px;
        box-shadow: 0 2px 16px 0 rgba(0, 0, 0, 0.06);

        &.expand {
          height: 300px;

          .fileTreeWrap {
            visibility: visible;
          }
        }

        .fileTreeToolbar {
          width: 100%;
          height: 30px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid #e9e9e9;
          margin-bottom: 12px;
          padding-left: 12px;

          .fileTreeName {
          }

          .fileTreeActionList {
            .btn {
              font-size: 18px;
              margin-left: 12px;
              cursor: pointer;
            }
          }
        }

        .fileTreeWrap {
          width: 100%;
          height: 100%;
          overflow: auto;
          visibility: hidden;

          .customTreeNode {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            padding-right: 5px;

            .treeNodeInfo {
              display: flex;
              align-items: center;

              .treeNodeIcon {
                margin-right: 5px;
                opacity: 0.7;
              }

              .treeNodeName {
                max-width: 200px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
              }
            }

            .treeNodeBtnList {
              display: flex;
              align-items: center;
            }
          }
        }
      }
    }

    .toolbarBtn {
      display: flex;
      justify-content: center;
      flex-direction: column;
      cursor: pointer;
      margin-right: 20px;

      &:last-of-type {
        margin-right: 0;
      }

      &:hover {
        &:not(.disabled) {
          .icon {
            background: #f5f5f5;
          }
        }
      }

      &.active {
        .icon {
          background: #f5f5f5;
        }
      }

      &.disabled {
        color: #bcbcbc;
        cursor: not-allowed;
        pointer-events: none;
      }

      .icon {
        display: flex;
        height: 26px;
        background: #fff;
        border-radius: 4px;
        border: 1px solid #e9e9e9;
        justify-content: center;
        flex-direction: column;
        text-align: center;
        padding: 0 5px;
      }

      .text {
        margin-top: 3px;
      }
    }
  }
}

/* SiYuan compact toolbar: one line, no forced format row, no empty file card. */
.toolbarContainer .toolbar.siyuan-compact-toolbar {
  top: 8px;
  max-width: calc(100vw - 24px);
  width: max-content;
  z-index: 15;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block {
  box-sizing: border-box;
  display: flex;
  flex-wrap: nowrap !important;
  align-items: center;
  gap: 0;
  margin: 0;
  padding: 5px 8px;
  max-width: 100%;
  height: 46px;
  box-shadow: 0 1px 7px rgba(0, 0, 0, .08);
}
/* Only the node icons scroll on narrow screens; file/format/minimize do not. */
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-tools {
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: #c4c4c4 transparent;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-tools::-webkit-scrollbar {
  height: 3px;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-tools::-webkit-scrollbar-thumb {
  background-color: #c4c4c4;
  border-radius: 3px;
}
/* The file popover may render a reference wrapper. Both controls are
   placed in one zero-gap flex group, so no inherited 20px toolbar margin
   or Element UI wrapper can create the unwanted empty slot. */
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-secondary {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  white-space: nowrap;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-secondary > * {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex: 0 0 38px !important;
  width: 38px !important;
  min-width: 38px !important;
  max-width: 38px !important;
  margin: 0 !important;
  padding: 0 !important;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-secondary .siyuan-compact-file-control {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  flex: 0 0 38px !important;
  width: 38px !important;
  min-width: 38px !important;
  max-width: 38px !important;
  margin: 0 !important;
  padding: 0 !important;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-file-control /deep/ .el-popover__reference-wrapper,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-file-control /deep/ .toolbarBtn,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-secondary .toolbarBtn.siyuan-compact-action {
  box-sizing: border-box;
  flex: 0 0 38px !important;
  width: 38px !important;
  min-width: 38px !important;
  max-width: 38px !important;
  margin: 0 !important;
  padding: 0 !important;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block /deep/ .toolbarNodeBtnList {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  min-width: max-content;
  flex: 0 0 auto;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block /deep/ .toolbarNodeBtnList .toolbarBtn,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block > .toolbarBtn,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block > .el-popover__reference-wrapper .toolbarBtn {
  box-sizing: border-box;
  width: 40px;
  min-width: 40px;
  height: 36px;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  border-radius: 4px;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block /deep/ .toolbarNodeBtnList .toolbarBtn .icon,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .toolbarBtn .icon {
  box-sizing: border-box;
  height: 29px;
  width: 32px;
  min-width: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block /deep/ .toolbarNodeBtnList .toolbarBtn .text {
  display: none;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-action {
  width: 38px;
  min-width: 38px;
  height: 36px;
  margin: 0;
  cursor: pointer;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-action .icon {
  height: 20px;
  width: 32px;
  min-width: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  line-height: 20px;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-action .text {
  display: block;
  white-space: nowrap;
  font-size: 10px;
  line-height: 13px;
  margin-top: 0;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-format-host {
  position: absolute;
  top: 49px;
  left: 0;
  width: auto;
  height: auto;
  max-width: min(520px, calc(100vw - 32px));
  box-sizing: border-box;
  padding: 4px 6px;
  margin: 0;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 5px;
  box-shadow: 0 2px 12px #0002;
  z-index: 20;
}
.toolbarContainer.isDark .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-format-host {
  background: #262a2e;
  border-color: #464a4e;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .fileTreeBox {
  top: 49px;
  width: 320px;
  min-width: 260px;
  max-width: calc(100vw - 24px);
}
@media (max-width: 620px) {
 .toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block { padding: 4px; gap: 1px; }
}

/* Standalone toolbar minimize / restore is independent of the mind-map block. */
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-block .siyuan-compact-toggle,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-toolbar-restore {
  box-sizing: border-box;
  border: 0;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  font-size: 16px;
  font-family: inherit;
  padding: 0;
  width: 30px;
  min-width: 30px;
  max-width: 30px;
  height: 30px;
  flex: 0 0 30px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-toggle:hover,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-toolbar-restore:hover,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-toggle:focus-visible,
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-toolbar-restore:focus-visible {
  background: rgba(127,127,127,.13);
  outline: 2px solid rgba(80,135,220,.35);
}
.toolbarContainer .toolbar.siyuan-compact-toolbar .siyuan-compact-toggle span { display: block; font-size: 20px; line-height: 1; }
.toolbarContainer .toolbar.siyuan-compact-toolbar.siyuan-toolbar-minimized {
  width: max-content;
  max-width: calc(100vw - 24px);
  top: 8px;
  z-index: 15;
}
.toolbarContainer .toolbar.siyuan-compact-toolbar.siyuan-toolbar-minimized .siyuan-toolbar-restore {
  width: 30px;
  min-width: 30px;
  max-width: 30px;
  height: 30px;
  padding: 0;
  background: #fff;
  border: 1px solid rgba(0,0,0,.10);
  box-shadow: 0 1px 7px rgba(0,0,0,.09);
}
.toolbarContainer.isDark .toolbar.siyuan-compact-toolbar.siyuan-toolbar-minimized .siyuan-toolbar-restore {
  background: #262a2e;
  border-color: #454b50;
}

</style>

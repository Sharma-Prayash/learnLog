import { useState, useRef } from 'react'
import { ChevronRight, Folder, FolderOpen, Trash2, Pencil, FolderPlus, X, Check } from 'lucide-react'
import LessonItem from './LessonItem'
import './FolderTree.css'

export default function FolderTree({ nodes, onToggleLesson, onPreview, isAdmin = false, onDeleteNode, onRenameNode, onUploadToFolder, classroomId }) {
  const tree = buildTree(nodes)

  return (
    <div className="folder-tree" id="folder-tree">
      {tree.length === 0 ? (
        <div className="tree-empty">
          <p>No files uploaded yet. Use the upload section above to add course content.</p>
        </div>
      ) : (
        tree.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            onToggleLesson={onToggleLesson}
            onPreview={onPreview}
            depth={0}
            isAdmin={isAdmin}
            onDeleteNode={onDeleteNode}
            onRenameNode={onRenameNode}
            onUploadToFolder={onUploadToFolder}
            classroomId={classroomId}
          />
        ))
      )}
    </div>
  )
}

function TreeNode({ node, onToggleLesson, onPreview, depth, isAdmin, onDeleteNode, onRenameNode, onUploadToFolder, classroomId }) {
  const [isOpen, setIsOpen] = useState(depth < 2)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newName, setNewName] = useState(node.name)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleRename() {
    if (newName.trim() && newName.trim() !== node.name) {
      onRenameNode(node.id, newName.trim())
    }
    setIsRenaming(false)
  }

  function handleDelete(e) {
    e.stopPropagation()
    const typeLabel = node.type === 'folder' ? 'folder and all its contents' : 'file'
    if (window.confirm(`Delete "${node.name}"? This will permanently remove the ${typeLabel}.`)) {
      onDeleteNode(node.id)
    }
  }

  function handleUploadToThisFolder() {
    fileInputRef.current?.click()
  }

  function handleFilesSelected(e) {
    const selectedFiles = Array.from(e.target.files)
    if (selectedFiles.length === 0) return

    const fileList = []
    const pathList = []

    selectedFiles.forEach((file) => {
      if (file.webkitRelativePath) {
        fileList.push(file)
        pathList.push(file.webkitRelativePath)
      }
    })

    if (fileList.length > 0) {
      onUploadToFolder(classroomId, fileList, pathList, node.id)
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (node.type === 'file') {
    return (
      <div style={{ paddingLeft: `${depth * 20}px` }} className="tree-file-row">
        <LessonItem node={node} onToggle={onToggleLesson} onPreview={onPreview} isAdmin={isAdmin} />
        {isAdmin && (
          <div className="tree-admin-actions file-actions">
            <button className="tree-action-btn" onClick={() => { setIsRenaming(true); setNewName(node.name) }} title="Rename">
              <Pencil size={12} />
            </button>
            <button className="tree-action-btn tree-action-delete" onClick={handleDelete} title="Delete">
              <Trash2 size={12} />
            </button>
          </div>
        )}
        {isAdmin && isRenaming && (
          <div className="rename-inline" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false) }}
              autoFocus
              className="rename-input"
            />
            <button className="tree-action-btn" onClick={handleRename}><Check size={12} /></button>
            <button className="tree-action-btn" onClick={() => setIsRenaming(false)}><X size={12} /></button>
          </div>
        )}
      </div>
    )
  }

  // Folder node
  const completedCount = countCompleted(node)
  const totalCount = countTotal(node)
  const allDone = totalCount > 0 && completedCount === totalCount

  return (
    <div className="tree-folder animate-fade-in" id={`folder-${node.id}`}>
      <div className="tree-folder-row">
        <button
          className={`tree-folder-header ${allDone ? 'folder-complete' : ''}`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <ChevronRight
            size={14}
            className={`tree-chevron ${isOpen ? 'tree-chevron-open' : ''}`}
          />
          {isOpen ? (
            <FolderOpen size={16} className="tree-folder-icon" />
          ) : (
            <Folder size={16} className="tree-folder-icon" />
          )}

          {isRenaming ? (
            <div className="rename-inline" onClick={(e) => e.stopPropagation()}>
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setIsRenaming(false) }}
                autoFocus
                className="rename-input"
              />
              <button className="tree-action-btn" onClick={(e) => { e.stopPropagation(); handleRename() }}><Check size={12} /></button>
              <button className="tree-action-btn" onClick={(e) => { e.stopPropagation(); setIsRenaming(false) }}><X size={12} /></button>
            </div>
          ) : (
            <span className="tree-folder-name">{node.name}</span>
          )}

          {totalCount > 0 && !isRenaming && (
            <span className={`tree-folder-count ${allDone ? 'count-complete' : ''}`}>
              {completedCount}/{totalCount}
            </span>
          )}
        </button>

        {isAdmin && !isRenaming && (
          <div className="tree-admin-actions">
            <button className="tree-action-btn" onClick={handleUploadToThisFolder} title="Upload to this folder">
              <FolderPlus size={13} />
            </button>
            <button className="tree-action-btn" onClick={(e) => { e.stopPropagation(); setIsRenaming(true); setNewName(node.name) }} title="Rename">
              <Pencil size={12} />
            </button>
            <button className="tree-action-btn tree-action-delete" onClick={handleDelete} title="Delete folder">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Hidden file input for upload-to-folder */}
      {isAdmin && (
        <input
          ref={fileInputRef}
          type="file"
          webkitdirectory=""
          multiple
          onChange={handleFilesSelected}
          style={{ display: 'none' }}
        />
      )}

      {isOpen && node.children && (
        <div className="tree-folder-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onToggleLesson={onToggleLesson}
              onPreview={onPreview}
              depth={depth + 1}
              isAdmin={isAdmin}
              onDeleteNode={onDeleteNode}
              onRenameNode={onRenameNode}
              onUploadToFolder={onUploadToFolder}
              classroomId={classroomId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helper functions ──

function buildTree(nodes) {
  const map = new Map()
  const roots = []

  nodes.forEach((node) => {
    map.set(node.id, { ...node, children: [] })
  })

  nodes.forEach((node) => {
    const current = map.get(node.id)
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(current)
    } else {
      roots.push(current)
    }
  })

  const sortNodes = (arr) => {
    arr.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    arr.forEach((node) => {
      if (node.children.length > 0) sortNodes(node.children)
    })
  }

  sortNodes(roots)
  return roots
}

function countCompleted(node) {
  if (node.type === 'file') return node.completed ? 1 : 0
  return (node.children || []).reduce((sum, child) => sum + countCompleted(child), 0)
}

function countTotal(node) {
  if (node.type === 'file') return 1
  return (node.children || []).reduce((sum, child) => sum + countTotal(child), 0)
}

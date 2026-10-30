# Compatibility contract

Plugin ID `siyuan-mindmap` and custom block type `mindmap` remain unchanged. The stable serialized format is the single-line JSON inside `;;;siyuan-mindmap/mindmap` blocks; existing blocks must not be converted automatically. Settings retain the original key and values.

Regression gates to pass in real SiYuan: saving and remounting without lost text; no unrelated menu/title overlay; IME typing; docked toolbar selection; theme `simpleBlack`; legacy data; disabling and enabling plugin; two documents/tabs with the same block; export a backup. Back up the workspace before installing a new build.

class_name ShowableView extends InputHandler

var path: String = '.'
var callback: Callable
var is_top_level: bool
var is_hidden: bool

func init(_config: Dictionary, cb: Callable) -> void:
    #print('INIT ', get_path(), ' WITH ', cb.hash())
    if !is_hidden: show_self()
    self.callback = cb
    #self.update(config)

func update(_config, _strict: bool = false) -> void: pass

func abort() -> void:
    hide_self()

func show_self() -> void:
    (get_tree().current_scene as ServerNode).show_view(self)

func hide_self() -> void:
    (get_tree().current_scene as ServerNode).hide_view(self)

extends MarginContainer

@export var text_edit_1: TextEdit
@export var text_edit_2: TextEdit
@export var show_decoded: CheckBox

func _ready() -> void:
    var err := show_decoded.toggled.connect(_on_show_decoded_toggled); assert(err == OK)
    _on_show_decoded_toggled(false)

func _on_show_decoded_toggled(on: bool) -> void:
    text_edit_1.visible = on
    text_edit_2.visible = !on

func _process(_delta: float) -> void:
    #var t := text_edit_2.scroll_vertical / text_edit_2.get_line_count()
    #text_edit_1.scroll_vertical = t * text_edit_1.get_line_count()
    #text_edit_1.scroll_vertical = text_edit_2.scroll_vertical
    pass

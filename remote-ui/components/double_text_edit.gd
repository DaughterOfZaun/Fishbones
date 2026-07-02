extends MarginContainer

@export var text_edit_1: TextEdit
@export var text_edit_2: TextEdit

func _process(_delta: float) -> void:
	var t := text_edit_2.scroll_vertical / text_edit_2.get_line_count()
	text_edit_1.scroll_vertical = t * text_edit_1.get_line_count()
	#text_edit_1.scroll_vertical = text_edit_2.scroll_vertical

extends Button

enum Action { Unspecified, Copy, Paste }
@export var action: Action
@export var textarea: TextEdit

func _pressed() -> void:
    if action == Action.Copy:
        DisplayServer.clipboard_set(textarea.text)
    if action == Action.Paste:
        textarea.text = DisplayServer.clipboard_get()

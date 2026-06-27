class_name ImageLoader extends Node

#TODO: Move to a separate class.
static var current_exe := OS.get_executable_path()
static var cwd := current_exe.get_base_dir()
static var downloads_dir_name := "Fishbones_Data"
static var downloads := cwd.path_join(downloads_dir_name)

#static var client_dir_name := 'playable_client_126'
#static var client_sln_version := '0.0.0.51'
#static var client_absolute_path := \
#    'C:/Riot Games/League of Legends/RADS/solutions/lol_game_client_sln/releases/' + client_sln_version if OS.get_name() == "Windows" \
#    else downloads.path_join(client_dir_name)
#static var client_data_absolute_path := client_absolute_path.path_join('DATA')

static var tile_dimensions_and_index_regex := RegEx.create_from_string(r"(^.*-(\d+)x(\d+)\..*):(\d+)")

static var null_ImageTexture := Texture2D.new()
static var texture_cache: Dictionary[String, Texture2D] = {}
static func get_texture(path: String) -> Texture2D:
	var result: bool
	var path_to_load := path
	var texture: Texture2D = texture_cache.get(path, null_ImageTexture)
	if texture == null_ImageTexture:
		if path.begins_with('res://'):
			
			var m := tile_dimensions_and_index_regex.search(path)
			if m:
				path_to_load = m.strings[1]
				var tile_dimensions := Vector2i(m.strings[2].to_int(), m.strings[3].to_int())
				var tile_index := m.strings[4].to_int()
				
				texture = texture_cache.get(path_to_load, null_ImageTexture)
				if texture == null_ImageTexture:
					texture = load(path_to_load)
					result = texture_cache.set(path_to_load, texture); assert(result == true)
				
				texture = create_atlas_texture(texture, tile_dimensions, tile_index)
				
			else:
				texture = load(path_to_load)
				result = texture_cache.set(path_to_load, texture); assert(result == true)
			
		elif path.ends_with('.dds') || path.ends_with('.DDS'):
			#if path.begins_with('%DATA%'): path_to_load = path.replace('%DATA%', client_data_absolute_path)
			#else: path_to_load = downloads.path_join(path)

			var bytes := FileAccess.get_file_as_bytes(path_to_load)
			var image := Image.new()
			var err := image.load_dds_from_buffer(bytes); assert(err == OK)
			texture = ImageTexture.create_from_image(image)
			result = texture_cache.set(path_to_load, texture); assert(result == true)

	return texture

static func create_atlas_texture(texture: Texture2D, tile_dimensions: Vector2i, tile_index: int) -> Texture2D:
	var atlas_texture := AtlasTexture.new()
	atlas_texture.atlas = texture
	@warning_ignore_start("integer_division")
	var texture_width := atlas_texture.atlas.get_width()
	var texture_width_in_tiles := texture_width / tile_dimensions.x
	assert(texture_width % tile_dimensions.x == 0)
	atlas_texture.region = Rect2(
		(tile_index % texture_width_in_tiles) * tile_dimensions.x,
		(tile_index / texture_width_in_tiles) * tile_dimensions.y,
		tile_dimensions.x,
		tile_dimensions.y,
	)
	@warning_ignore_restore("integer_division")
	return atlas_texture

#var null_Array := []
#var deferred_texture_assignements: Dictionary[String, Array] = {}
#func defer_texture_assignement(obj: Object, prop: String, path: String) -> void:
#	var dassign: Array = deferred_texture_assignements.get(path, null_Array)
#	if dassign == null_Array:
#		var err := ResourceLoader.load_threaded_request(path, 'Texture2D'); assert(err == OK)
#		dassign = []

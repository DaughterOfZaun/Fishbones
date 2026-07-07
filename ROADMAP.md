# Roadmap

## Introduction
Software development can be viewed as an optimization problem.<br>
In the case of Fishbones, the following optimization areas can be identified:

### 1. Improving Resilience
Corporations don't like encroachments on their source of income and do everything possible to nip projects like ours in the bud. Therefore, we must be prepared for blocking of repositories and file-sharing services, as well as threats to developers and users.

#### Two Ways to Increase Resilience
The simplest way to achieve resilience to external influences is to create an independent mesh network from running launcher instances. Where a mesh network fails, helper servers come to the rescue.

#### Reducing dependence on centralized infrastructure
- Fix the service for finding peers via DHT.
- Allow users to specify their own mirrors and helper servers, in addition to the hardcoded ones.

#### Improving the reliability of update delivery
Any issue can be resolved by releasing a patch if it reaches the end user.
The self-updating system should allow notifications about new versions to be sent offline, via short messages.

#### Improving the file retrieval mechanism
- Improve integrity checking either by pushing metalink files to the aria2c downloader or by making torrent files usage mandatory.

- Allow launcher instances to request files from each other not only via torrent but also via libp2p, using the fetch protocol or ipfs.
- Modernize downloader so that it can differentiate between aria2c, mega, libp2p-fetch, and other downloads by link.
- Remove js-fetch from the code and use aria2 (and fetch as a fallback).

#### Simplify installation of the helper server
Ideally, it should be a standalone .exe file, like the launcher.<br>
Initially, detailed documentation for system administrators will be sufficient.

#### Expanding the functionality of the helper server
- Add the ability to host games and run a game server.
- Add a WebRTC STUN server.

### 2. Improving the user experience

- Distribute the launcher as a single executable file, reducing its size and not compressing it into an archive.
- Distribute the "full" version separately, which does not require an initial download of resources.
- Download some resources initially and offer a tutorial during installation.
- Reduce startup time by not repackaging the launcher when it finds an archive and offering to check and download updates in the background.
- Reduce the direct connection codes by using the same compression algorithm as for updates.
- Unify the interface, bringing it to a single visual style.
- Allow recording and playback of saved matches.

### 3. Improving the developer experience
- Implement a system for automatically sending error reports.

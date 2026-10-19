'use strict';

const settings = require('../../src/settings');

var clientId = "";
var clientSecret = "";

if (settings.spotify) {
  clientId = settings.spotify.clientId;
  clientSecret = settings.spotify.clientSecret;
}

let clientToken: any = null;

const spotifyDef: any = {
  country:   '&market=',
  search:    {
               album:   'https://api.spotify.com/v1/search?type=album&limit=1&q=album:',
               song:    'https://api.spotify.com/v1/search?type=track&limit=50&q=',
               station: 'https://api.spotify.com/v1/search?type=artist&limit=1&q=',
               playlist: 'https://api.spotify.com/v1/search?type=playlist&q='
             },
  metastart: {
               album:   '0004206cspotify%3aalbum%3a',
               song:    '00032020spotify%3atrack%3a',
               station: '000c206cspotify:artistRadio%3a',
               playlist: '0004206cspotify%3aplaylist%3a'
             },
  parent:    {
               album:   '00020000album:',
               song:    '00020000track:',
               station: '00052064spotify%3aartist%3a',
               playlist:'00020000playlist:',
             },
  object:    {
               album:   'container.album.musicAlbum',
               song:    'item.audioItem.musicTrack',
               station: 'item.audioItem.audioBroadcast.#artistRadio',
               playlist:'container.playlistContainer',
             },

  service:   setService,
  term:      getSearchTerm,
  tracks:    loadTracks,
  empty:     isEmpty,
  metadata:  getMetadata,
  urimeta:   getURIandMetadata,
  headers:   getTokenHeaders,
  authenticate: authenticateService,
}

var  toBase64 = (string: any) => Buffer.from(string).toString('base64');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

const mapResponse = (response: any) => ({
  accessToken: response.access_token,
  tokenType: response.token_type,
  expiresIn: response.expires_in,
});

const getHeaders = () => {
  if (!clientId || !clientSecret) {
    throw new Error('You are missing spotify clientId and secret in settings.json! Please read the README for instructions on how to generate and add them');
  }
  const authString = `${clientId}:${clientSecret}`;
  return {
    Authorization: `Basic ${toBase64(authString)}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
};

const auth = () => {
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  return fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: getHeaders(),
    body,
    signal: AbortSignal.timeout(10000)
  }).then((response: any) => {
    if (!response.ok) {
      throw new Error(`Unable to authenticate Spotify with client id: ${clientId}`);
    }
    return response.json();
  }).then(mapResponse);
};

function getTokenHeaders() {
  if (clientToken == null) {
    return null;
  }
  return {
    Authorization: `Bearer ${clientToken}`
  };
}

function authenticateService() {
  return new Promise<void>((resolve: any, reject: any) => {
    auth().then((response: any) => {
      const accessToken = response.accessToken;
      clientToken = accessToken;
      resolve();
    }).catch(reject);
  });
}

function getURI(type:  any, id:  any): any {
  if (type == 'album') {
    return `x-rincon-cpcontainer:0004206c${id}`;
  } else
  if (type == 'song') {
    return `x-sonos-spotify:spotify%3atrack%3a${id}?sid=${sid}&flags=8224&sn=${accountSN}`;
  } else
  if (type == 'station') {
    return `x-sonosapi-radio:spotify%3aartistRadio%3a${id}?sid=${sid}&flags=8300&sn=${accountSN}`;
  } else
  if (type == 'playlist') {
    return `x-rincon-cpcontainer:0006206c${id}`;
  }
}

function getServiceToken() {
  return `SA_RINCON${serviceType}_X_#Svc${serviceType}-0-Token`;
}


var sid = '';
var serviceType = '';
var accountId = '';
var accountSN = '';
var country = '';

function setService(player:  any, p_accountId:  any, p_accountSN:  any, p_country:  any)
{
  sid = player.system.getServiceId('Spotify');
  serviceType = player.system.getServiceType('Spotify');
  accountId = p_accountId;
  accountSN = '14'; // GACALD: Hack to fix Spotify p_accountSN;
  country = p_country;
}

function getSearchTerm(type:  any, term:  any, artist:  any, album:  any, track:  any) {
  var newTerm = '';

  if (album != '') {
    newTerm = album + ' ';
  }
  if (artist != '') {
    newTerm += 'artist:' + artist + ((track != '')?' ':'');
  }
  if (track != '') {
    newTerm += 'track:' + track;
  }
  newTerm = encodeURIComponent(newTerm);

  return newTerm;
}

function getMetadata(type:  any, id:  any, name:  any, title:  any) {
  const token = getServiceToken();
  const parentUri = spotifyDef.parent[type] + name;
  const objectType = spotifyDef.object[type];

  if (type != 'station') {
    title = '';
  }

  return `<DIDL-Lite xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:upnp="urn:schemas-upnp-org:metadata-1-0/upnp/"
          xmlns:r="urn:schemas-rinconnetworks-com:metadata-1-0/" xmlns="urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/">
          <item id="${id}" parentID="${parentUri}" restricted="true"><dc:title>${title}</dc:title><upnp:class>object.${objectType}</upnp:class>
          <desc id="cdudn" nameSpace="urn:schemas-rinconnetworks-com:metadata-1-0/">${token}</desc></item></DIDL-Lite>`;
}

function getURIandMetadata(type:  any, resList:  any)
{
  var Id = '';
  var Title = '';
  var Name = '';
  var MetadataID = '';
  var UaM = {
              uri: '',
              metadata: ''
            };

  var items = [];

  if (type == 'album') {
    items = resList.albums.items;
  } else
  if (type == 'station') {
    items = resList.artists.items;
  } else
  if (type == 'playlist') {
    items = resList.playlists.items;
  }

  Id = items[0].id;
  Title = items[0].name + ((type=='station')?' Radio':'');
  Name = Title.toLowerCase().replace(' radio','').replace('radio ','');
  MetadataID = spotifyDef.metastart[type] + encodeURIComponent(Id);

  UaM.metadata = getMetadata(type, MetadataID, (type=='album' || type=='playlist')?Title.toLowerCase() : Id, Title);
  UaM.uri = getURI(type, encodeURIComponent((type=='station')?items[0].id:items[0].uri));

  return UaM;
}

function loadTracks(type:  any, tracksJson:  any)
{
  var tracks = { count : 0,
                 isArtist : false,
                 queueTracks : []
                };

  if (tracksJson.tracks.items.length > 0) {
    // Filtered list of tracks to play
    tracks.queueTracks = tracksJson.tracks.items.reduce(function (tracksArray: any, track: any) {
      if (track.available_markets == null || track.available_markets.indexOf(country) != -1) {
        var skip = false;

        for (var j=0; (j < tracksArray.length) && !skip ; j++) {
          // Skip duplicate songs
          skip = (track.name == tracksArray[j].trackName);
        }

        if (!skip) {
          var metadataID = spotifyDef.metastart['song'] + encodeURIComponent(track.id);
          var metadata = getMetadata('song', metadataID, track.id, track.name);
          var uri = getURI('song', encodeURIComponent(track.id));

          tracksArray.push({trackName:track.name, artistName:(track.artists.length>0)?track.artists[0].name:'', uri:uri, metadata:metadata});
          tracks.count++;
        }
      }
      return tracksArray;
    }, []);
  }

  return tracks;
}

function isEmpty(type:  any, resList:  any)
{
  var count = 0;

  if (type == 'album') {
    count = resList.albums.items.length;
  } else
  if (type == 'song') {
    count = resList.tracks.items.length;
  } else
  if (type == 'station') {
    count = resList.artists.items.length;
  } else
  if (type == 'playlist') {
    count = resList.playlists.items.length;
  }

  return (count == 0);
}

module.exports = spotifyDef;


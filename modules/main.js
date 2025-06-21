( function () {
	'use strict';

	let whitelist = mw.config.get( 'ExternalLinkConfirmWhitelist' ),
		domainTarget = mw.config.get( 'ExternalLinkConfirmTarget' ),
		defaultTarget = mw.config.get( 'ExternalLinkConfirmDefaultTarget' ),
		poolToHandle = [],
		handlePoolDebounced;

	function getHostname( url ) {
		const a = document.createElement( 'a' );
		a.href = url;
		return a.hostname;
	}

	function getWildcardMatchedDomain( listDomains, domain ) {
		let domainPieces = domain.split( '.' ),
			valid, listedDomain, listedDomainPieces, i, k, piece;

		if ( listDomains.length === 0 ) {
			return false;
		}

		for ( k in listDomains ) {
			if ( Object.prototype.hasOwnProperty.call( listDomains, k ) ) {
				listedDomain = listDomains[ k ];
				listedDomainPieces = listedDomain.split( '.' );
				if ( domainPieces.length === listedDomainPieces.length ) {
					valid = true;
					for ( i = 0; i < listedDomainPieces.length; i++ ) {
						piece = listedDomainPieces[ i ];
						if ( piece !== '*' && piece !== domainPieces[ i ] ) {
							valid = false;
							break;
						}
					}
					if ( valid ) {
						return listedDomain;
					}
				}
			}
		}

		return false;
	}

	function isWhitelistedDomain( domain ) {
		if ( whitelist.length === 0 ) {
			return false;
		}

		return !!getWildcardMatchedDomain( whitelist, domain );
	}

	function getTargetForDomain( domain ) {
		const targetKeys = Object.keys( domainTarget ),
			key = getWildcardMatchedDomain( targetKeys, domain );

		if ( key !== false ) {
			return domainTarget[ key ];
		}
		return defaultTarget;
	}

	function openLink( href ) {
		const host = getHostname( href ),
			target = getTargetForDomain( host ),
			otherWindow = window.open( href, target );

		otherWindow.opener = null; // Detach opened web page
	}

	function onHandledLinkClick( e ) {
		const href = $( this ).data( 'ExternalLinkConfirmHref' );

		e.preventDefault();

		// eslint-disable-next-line no-alert
		if ( confirm( mw.msg( 'externallinkconfirm-confirmation-message' ) ) ) {
			openLink( href );
		}
	}

	/**
	 * @param {jQuery} $element
	 */
	function handleExternalLinks( $element ) {
		let $unhandledLinks, href;

		if ( $element.prop( 'tagName' ) === 'A' ) {
			href = $element.attr( 'href' );
			// eslint-disable-next-line no-jquery/no-class-state
			if ( $element.hasClass( 'ExternalLinkConfirmHandled' ) || !href || !href.includes( '//' ) ) {
				return;
			}
			$unhandledLinks = $element;
		} else {
			$unhandledLinks = $element.find( 'a[href*="//"]:not( .ExternalLinkConfirmHandled )' );
		}

		if ( $unhandledLinks.length > 0 ) {
			$unhandledLinks
				.each( function () {
					const $el = $( this ),
						hr = $el.attr( 'href' ),
						hrefHost = getHostname( hr ),
						target = getTargetForDomain( hrefHost );

					if ( hrefHost !== window.location.hostname ) {
						if ( isWhitelistedDomain( hrefHost ) ) {
							// Don't use onHandledLinkClick for whitelisted domains
							// but use defined target
							$el.attr( 'target', target );
						} else {
							$el
								.data( 'ExternalLinkConfirmHref', hr )
								.attr( 'href', '' )
								.off( 'click' )
								.on( 'click', onHandledLinkClick );
						}
					}
				} )
				.addClass( 'ExternalLinkConfirmHandled' );
		}
	}

	mw.hook( 'wikipage.content' ).add( handleExternalLinks );

	function handlePool() {
		let elem;

		while ( typeof ( elem = poolToHandle.shift() ) !== 'undefined' ) {
			handleExternalLinks( $( elem ) );
		}
	}

	handlePoolDebounced = OO.ui.debounce( handlePool, 100 );

	$( window ).on( 'DOMNodeInserted', ( event ) => {
		poolToHandle.push( event.target );
		handlePoolDebounced();
	} );

	// eslint-disable-next-line no-jquery/no-global-selector
	handleExternalLinks( $( 'body' ) );

}() );

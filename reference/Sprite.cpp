// Sprite.cpp: implementation of the CSprite class.
//
//////////////////////////////////////////////////////////////////////

#include "Sprite.h"

extern char G_cSpriteAlphaDegree;

extern int G_iAddTable31[64][510], G_iAddTable63[64][510];
extern int G_iAddTransTable31[510][64], G_iAddTransTable63[510][64]; 

extern long    G_lTransG100[64][64], G_lTransRB100[64][64];
extern long    G_lTransG70[64][64], G_lTransRB70[64][64];
extern long    G_lTransG50[64][64], G_lTransRB50[64][64];
extern long    G_lTransG25[64][64], G_lTransRB25[64][64];
extern long    G_lTransG2[64][64], G_lTransRB2[64][64];


//////////////////////////////////////////////////////////////////////
// Construction/Destruction
//////////////////////////////////////////////////////////////////////
CSprite::CSprite(HANDLE hPakFile, DXC_ddraw *pDDraw, char *cPakFileName, short sNthFile, bool bAlphaEffect)
{
	DWORD  nCount;
	int iASDstart;

	m_stBrush	= NULL;
	m_lpSurface = NULL;
	m_bIsSurfaceEmpty = TRUE;
	ZeroMemory(m_cPakFileName, sizeof(m_cPakFileName));

	m_cAlphaDegree = 1;
	m_bOnCriticalSection = FALSE;
	m_iTotalFrame = 0;
	m_pDDraw = pDDraw;
	SetFilePointer(hPakFile, 24 + sNthFile*8, NULL, FILE_BEGIN);
	ReadFile(hPakFile, &iASDstart,  4, &nCount, NULL); 
	//i+100       Sprite Confirm
	SetFilePointer(hPakFile, iASDstart+100, NULL, FILE_BEGIN); 
	ReadFile(hPakFile, &m_iTotalFrame,  4, &nCount, NULL);
	m_dwBitmapFileStartLoc = iASDstart  + (108 + (12*m_iTotalFrame));
	m_stBrush = new stBrush[m_iTotalFrame];
	ReadFile(hPakFile, m_stBrush, 12*m_iTotalFrame, &nCount, NULL);
	// PAK
	memcpy(m_cPakFileName, cPakFileName, strlen(cPakFileName));
	m_bAlphaEffect = bAlphaEffect;
}

CSprite::~CSprite()
{
	if (m_stBrush != NULL) delete[] m_stBrush;
	if (m_lpSurface != NULL) m_lpSurface->Release();
}

IDirectDrawSurface7 * CSprite::_pMakeSpriteSurface()
{
 IDirectDrawSurface7 * pdds4;
 HDC hDC;
 WORD * wp;

	m_bOnCriticalSection = TRUE;

	if( m_stBrush == NULL ) return NULL;

	CMyDib mydib(m_cPakFileName, m_dwBitmapFileStartLoc);
	m_wBitmapSizeX = mydib.m_wWidthX;
	m_wBitmapSizeY = mydib.m_wWidthY;
	pdds4 = m_pDDraw->pCreateOffScreenSurface(m_wBitmapSizeX, m_wBitmapSizeY);
    if (pdds4 == NULL) return NULL; 
	pdds4->GetDC(&hDC);
	mydib.PaintImage(hDC);
	pdds4->ReleaseDC(hDC);

	DDSURFACEDESC2  ddsd;
	ddsd.dwSize = 124;
	if (pdds4->Lock(NULL, &ddsd, DDLOCK_WAIT, NULL) != DD_OK) return NULL;
	pdds4->Unlock(NULL);

	wp = (WORD *)ddsd.lpSurface;
	m_wColorKey = *wp;

	m_bOnCriticalSection = FALSE;

    return pdds4;
}


void CSprite::PutSpriteFast(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if( m_stBrush == NULL ) return;
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left)
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top)
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE)
	{
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	m_pDDraw->m_lpBackB4->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_SRCCOLORKEY | DDBLTFAST_WAIT );

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutSpriteFastDst(LPDIRECTDRAWSURFACE7 lpDstS, int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left)
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE)
	{	if( _iOpenSprite() == FALSE ) return;
	}else // AlphaDegree
	{	if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) 
			{	_SetAlphaDegree();
			}else 
			{	_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
	}	}	}

	//SetRect(&rcRect,  sx, sy, sx + szx, sy + szy); // our fictitious sprite bitmap is 
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;
	lpDstS->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_SRCCOLORKEY | DDBLTFAST_WAIT );
	m_bOnCriticalSection = FALSE;
}


void CSprite::PutSpriteFastNoColorKey(int sX, int sY, int sFrame, DWORD dwTime)
{short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;
	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;
  	dX = sX + pvx;
	dY = sY + pvy;
	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{	sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) 
		{	m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{	szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) 
		{	m_rcBound.top = -1;
			return;
	}	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{	sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) 
		{	m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{	szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) 
		{	m_rcBound.top = -1;
			return;
	}	}
	
	m_dwRefTime = dwTime;
	if (m_bIsSurfaceEmpty == TRUE)
	{	if( _iOpenSprite() == FALSE ) return;
	}else 
	{	if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) 
			{	_SetAlphaDegree();
			}else 
			{	_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
	}	}	}

	//SetRect(&rcRect,  sx, sy, sx + szx, sy + szy); // our fictitious sprite bitmap is 
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	m_pDDraw->m_lpBackB4->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_NOCOLORKEY | DDBLTFAST_WAIT );

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutSpriteFastNoColorKeyDst(LPDIRECTDRAWSURFACE7 lpDstS, int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;

	if (m_bIsSurfaceEmpty == TRUE) 
	{	if( _iOpenSprite() == FALSE ) return;
	}else 
	{	if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) 
			{	_SetAlphaDegree();
			}else 
			{	_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
	}	}	}

	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	lpDstS->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_NOCOLORKEY | DDBLTFAST_WAIT );

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutSpriteFastFrontBuffer(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&rcRect,  sx, sy, sx + szx, sy + szy); // our fictitious sprite bitmap is 
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	m_pDDraw->m_lpFrontB4->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_SRCCOLORKEY | DDBLTFAST_WAIT );

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutSpriteFastWidth(int sX, int sY, int sFrame, int sWidth, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (sWidth < szx)
		szx = sWidth;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&rcRect,  sx, sy, sx + szx, sy + szy); // our fictitious sprite bitmap is 
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	m_pDDraw->m_lpBackB4->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_SRCCOLORKEY | DDBLTFAST_WAIT );

	m_bOnCriticalSection = FALSE;
}


void CSprite::iRestore()
{
 HDC     hDC;
	
	if (m_bIsSurfaceEmpty) return;
	if( m_stBrush == NULL ) return;
	if (m_lpSurface->IsLost() == DD_OK) return;

	m_lpSurface->Restore();
	DDSURFACEDESC2  ddsd;
	ddsd.dwSize = 124;
	if (m_lpSurface->Lock(NULL, &ddsd, DDLOCK_WAIT, NULL) != DD_OK) return;
	m_pSurfaceAddr = (WORD *)ddsd.lpSurface;
	m_lpSurface->Unlock(NULL);
	CMyDib mydib(m_cPakFileName, m_dwBitmapFileStartLoc);
	m_lpSurface->GetDC(&hDC);
	mydib.PaintImage(hDC);
	m_lpSurface->ReleaseDC(hDC);
}

void CSprite::PutShadowSprite(int sX, int sY, int sFrame, DWORD dwTime)
{
	short sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;

	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

	m_dwRefTime = dwTime;

	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}

	int iSangX, iSangY;
	pSrc = (WORD *)m_pSurfaceAddr + sx + sy*m_sPitch;
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr;// + dX + ((dY+szy-1)*m_pDDraw->m_sBackB4Pitch);

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		for( iy=0 ; iy<szy ; iy+= 3 )
		{
			for( ix=0 ; ix<szx ; ix++ )
			{
				iSangX = sX+pvx+ix+(iy-szy)/3;
				iSangY = sY+pvy+(iy+szy+szy)/3;
				if (pSrc[ix] != m_wColorKey)
				{
					if( iSangX >= 0 && iSangX < 640 && iSangY >= 0 && iSangY < 427 )
					{
						pDst[iSangY*m_pDDraw->m_sBackB4Pitch+iSangX] = ((pDst[iSangY*m_pDDraw->m_sBackB4Pitch+iSangX] & 0xE79C) >> 2);
					}
				}
			}
			pSrc += m_sPitch + m_sPitch + m_sPitch;
		}
		break;
	case 2:
		for( iy=0 ; iy<szy ; iy+= 3 )
		{
			for( ix=0 ; ix<szx ; ix++ )
			{
				iSangX = sX+pvx+ix+(iy-szy)/3;
				iSangY = sY+pvy+(iy+szy+szy)/3;
				if (pSrc[ix] != m_wColorKey)
				{
					if( iSangX >= 0 && iSangX < 640 && iSangY >= 0 && iSangY < 427 )
					{
						pDst[iSangY*m_pDDraw->m_sBackB4Pitch+iSangX] = ((pDst[iSangY*m_pDDraw->m_sBackB4Pitch+iSangX] & 0x739C) >> 2);
					}
				}
			}
			pSrc += m_sPitch + m_sPitch + m_sPitch;
		}
		break;
	}
	m_bOnCriticalSection = FALSE;
}


void CSprite::PutShadowSpriteClip(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;
	
	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;
	
	if (dX < m_pDDraw->m_rcClipArea.left)
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy+szy-1)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY+szy-1)*m_pDDraw->m_sBackB4Pitch);

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		for (iy = 0; iy < szy; iy += 3) {
			for (ix = 0; ix < szx; ix++) {
				if (pSrc[ix] != m_wColorKey)
					if ( (dX - (iy/3) + ix)	> 0 )
						pDst[ix] = (pDst[ix] & 0xE79C) >> 2; 
			}
			pSrc -= m_sPitch + m_sPitch + m_sPitch;
			pDst -= m_pDDraw->m_sBackB4Pitch + 1;
		}
		break;

	case 2:
		for (iy = 0; iy < szy; iy += 3) {
			for (ix = 0; ix < szx; ix++) {
				if (pSrc[ix] != m_wColorKey)
					if ( (dX - (iy/3) + ix)	> 0 )
						pDst[ix] = (pDst[ix] & 0x739C) >> 2;
			}
			pSrc -= m_sPitch + m_sPitch + m_sPitch;
			pDst -= m_pDDraw->m_sBackB4Pitch + 1;
		}
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutTransSprite(int sX, int sY, int sFrame, DWORD dwTime, int alphaDepth)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB100[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG100[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB100[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB100[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG100[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB100[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutTransSprite_NoColorKey(int sX, int sY, int sFrame, DWORD dwTime, int alphaDepth)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB100[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG100[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB100[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB100[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG100[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB100[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutTransSprite70(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB70[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG70[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB70[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB70[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG70[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB70[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutTransSprite70_NoColorKey(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB70[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG70[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB70[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB70[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG70[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB70[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutTransSprite50(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB50[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG50[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB50[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB50[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG50[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB50[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutTransSprite50_NoColorKey(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB50[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG50[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB50[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB50[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG50[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB50[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutTransSprite25(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB25[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11] <<11) | (G_lTransG25[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5] <<5) | G_lTransRB25[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB25[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG25[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB25[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutTransSprite25_NoColorKey(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB25[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11] <<11) | (G_lTransG25[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5] <<5) | G_lTransRB25[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_lTransRB25[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG25[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB25[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutTransSprite2(int sX, int sY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;

	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB2[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG2[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB2[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB2[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG2[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB2[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutShiftTransSprite2(int sX, int sY, int shX, int shY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = 128;//m_stBrush[sFrame].szx;
	szy = 128;//m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

	sx += shX;
	sy += shY;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;

	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB2[(pDst[ix]&0xF800)>>11][(pSrc[ix]&0xF800)>>11]<<11) | (G_lTransG2[(pDst[ix]&0x7E0)>>5][(pSrc[ix]&0x7E0)>>5]<<5) | G_lTransRB2[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_lTransRB2[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10]<<10) | (G_lTransG2[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5]<<5) | G_lTransRB2[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutFadeSprite(short sX, short sY, short sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 //int dX,dY,sx,sy,szx,szy,pvx,pvy,sTmp;

	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		for (iy = 0; iy < szy; iy++) {
			for (ix = 0; ix < szx; ix++) {
				if (pSrc[ix] != m_wColorKey) 
					pDst[ix] = ((pDst[ix] & 0xE79C) >> 2); 
				
			}
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
		}
		break;

	case 2:
		for (iy = 0; iy < szy; iy++) {
			for (ix = 0; ix < szx; ix++) {
				if (pSrc[ix] != m_wColorKey)	
					pDst[ix] = ((pDst[ix] & 0x739C) >> 2);
				
			}
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
		}
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutFadeSpriteDst(WORD * pDstAddr, short sPitch, short sX, short sY, short sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy;
 WORD * pSrc, * pDst;
 //int           iRet, dX,dY,sx,sy,szx,szy,pvx,pvy,sTmp;

	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)pDstAddr + dX + ((dY)*sPitch);

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		for (iy = 0; iy < szy; iy++) {
			for (ix = 0; ix < szx; ix++) {
				if (pSrc[ix] != m_wColorKey) 
					pDst[ix] = ((pDst[ix] & 0xE79C) >> 2); 
				
			}
			pSrc += m_sPitch;
			pDst += sPitch;
		}
		break;

	case 2:
		for (iy = 0; iy < szy; iy++) {
			for (ix = 0; ix < szx; ix++) {
				if (pSrc[ix] != m_wColorKey)	
					pDst[ix] = ((pDst[ix] & 0x739C) >> 2);
				
			}
			pSrc += m_sPitch;
			pDst += sPitch;
		}
		break;
	}

	m_bOnCriticalSection = FALSE;
}


bool CSprite::_iOpenSprite()
{
  	if (m_lpSurface != NULL) return FALSE;
	m_lpSurface = _pMakeSpriteSurface(); 
	if (m_lpSurface == NULL) return FALSE;
	m_pDDraw->iSetColorKey(m_lpSurface, m_wColorKey);
	m_bIsSurfaceEmpty  = FALSE;
	DDSURFACEDESC2  ddsd;
	ddsd.dwSize = 124;
	if (m_lpSurface->Lock(NULL, &ddsd, DDLOCK_WAIT, NULL) != DD_OK) return FALSE;	
	m_pSurfaceAddr = (WORD *)ddsd.lpSurface;
	m_sPitch = (short)ddsd.lPitch >> 1;	
	m_lpSurface->Unlock(NULL);
	_SetAlphaDegree();
//	m_dwRefTime = timeGetTime();
	return TRUE;
}

void CSprite::_iCloseSprite()
{
	if( m_stBrush == NULL ) return;
	if (m_lpSurface == NULL) return;
	if (m_lpSurface->IsLost() != DD_OK)	return;
	m_lpSurface->Release();
	m_lpSurface = NULL;
	m_bIsSurfaceEmpty = TRUE;
	m_cAlphaDegree = 1;
}

void CSprite::PutSpriteRGB(int sX, int sY, int sFrame, int sRed, int sGreen, int sBlue, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 int  ix, iy, iRedPlus255, iGreenPlus255, iBluePlus255;
 WORD * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	if ((szx == 0) || (szy == 0)) return;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	iRedPlus255   = sRed +255;
	iGreenPlus255 = sGreen +255;
	iBluePlus255  = sBlue +255;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)(( G_iAddTable31[(pSrc[ix]&0xF800)>>11][iRedPlus255] <<11) | ( G_iAddTable63[(pSrc[ix]&0x7E0)>>5][iGreenPlus255] <<5) | G_iAddTable31[(pSrc[ix]&0x1F)][iBluePlus255]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_iAddTable31[(pSrc[ix]&0x7C00)>>10][iRedPlus255]<<10) | (G_iAddTable31[(pSrc[ix]&0x3E0)>>5][iGreenPlus255]<<5) | G_iAddTable31[(pSrc[ix]&0x1F)][iBluePlus255]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}


void CSprite::PutTransSpriteRGB(int sX, int sY, int sFrame, int sRed, int sGreen, int sBlue, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 short ix, iy, iRedPlus255, iGreenPlus255, iBluePlus255;
 WORD  * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	if ((szx == 0) || (szy == 0)) return;

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	iRedPlus255   = sRed +255;
	iGreenPlus255 = sGreen +255;
	iBluePlus255  = sBlue +255;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_iAddTransTable31[G_lTransRB100[(pDst[ix]&0xF800)>>11][((pSrc[ix]&0xF800)>>11)] + iRedPlus255][(pDst[ix]&0xF800)>>11]<<11) | (G_iAddTransTable63[G_lTransG100[(pDst[ix]&0x7E0)>>5][((pSrc[ix]&0x7E0)>>5)] + iGreenPlus255][(pDst[ix]&0x7E0)>>5]<<5) | G_iAddTransTable31[m_pDDraw->m_lTransRB100[(pDst[ix]&0x1F)][((pSrc[ix]&0x1F))] + iBluePlus255][(pDst[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					pDst[ix] = (WORD)((G_iAddTransTable31[G_lTransRB100[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10] +iRedPlus255][(pDst[ix]&0x7C00)>>10]<<10) | (G_iAddTransTable31[G_lTransG100[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5] +iGreenPlus255][(pDst[ix]&0x3E0)>>5]<<5) | G_iAddTransTable31[G_lTransRB100[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)] +iBluePlus255][(pDst[ix]&0x1F)]);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutTransSpriteRGB_NoColorKey(int sX, int sY, int sFrame, int sRed, int sGreen, int sBlue, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 short ix, iy, iRedPlus255, iGreenPlus255, iBluePlus255;
 WORD  * pSrc, * pDst;
 	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	m_dwRefTime = dwTime;
	
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);

	if ((szx == 0) || (szy == 0)) return;

	iRedPlus255   = sRed +255;
	iGreenPlus255 = sGreen +255;
	iBluePlus255  = sBlue +255;

	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_iAddTransTable31[G_lTransRB100[(pDst[ix]&0xF800)>>11][((pSrc[ix]&0xF800)>>11)] + iRedPlus255][(pDst[ix]&0xF800)>>11]<<11) | (G_iAddTransTable63[G_lTransG100[(pDst[ix]&0x7E0)>>5][((pSrc[ix]&0x7E0)>>5)] + iGreenPlus255][(pDst[ix]&0x7E0)>>5]<<5) | G_iAddTransTable31[m_pDDraw->m_lTransRB100[(pDst[ix]&0x1F)][((pSrc[ix]&0x1F))] + iBluePlus255][(pDst[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;

	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				pDst[ix] = (WORD)((G_iAddTransTable31[G_lTransRB100[(pDst[ix]&0x7C00)>>10][(pSrc[ix]&0x7C00)>>10] +iRedPlus255][(pDst[ix]&0x7C00)>>10]<<10) | (G_iAddTransTable31[G_lTransG100[(pDst[ix]&0x3E0)>>5][(pSrc[ix]&0x3E0)>>5] +iGreenPlus255][(pDst[ix]&0x3E0)>>5]<<5) | G_iAddTransTable31[G_lTransRB100[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F)] +iBluePlus255][(pDst[ix]&0x1F)]);
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}

	m_bOnCriticalSection = FALSE;
}

void CSprite::_GetSpriteRect(int sX, int sY, int sFrame)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	// v1.4
	m_rcBound.top    = -1;
	m_rcBound.bottom = -1;
	m_rcBound.left   = -1;
	m_rcBound.right  = -1;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	m_sPivotX = pvx;
	m_sPivotY = pvy;
}

void CSprite::_SetAlphaDegree()
{
 WORD * pSrc, wR, wG, wB, wTemp, ix, iy;
 int iR, iG, iB, sRed, sGreen, sBlue;
 
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_bOnCriticalSection = TRUE;
	if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
		
		m_cAlphaDegree = G_cSpriteAlphaDegree;
		switch (m_cAlphaDegree) {
		case 1:
			sRed = sGreen = sBlue = 0;
			break;

		case 2:
			sRed   = -3;
			sGreen = -3;
			sBlue  =  2;
			break;
		}

		pSrc = (WORD *)m_pSurfaceAddr;
		
		switch (m_pDDraw->m_cPixelFormat) {
		case 1:
			for (iy = 0; iy < m_wBitmapSizeY; iy++) 
			{	for (ix = 0; ix < m_wBitmapSizeX; ix++) 
				{	if (pSrc == NULL) return; 
					if (pSrc[ix] != m_wColorKey) 
					{	wR = (WORD)(pSrc[ix]&0xF800)>>11;
						wG = (WORD)(pSrc[ix]&0x7E0)>>5;
						wB = (WORD)(pSrc[ix]&0x1F);
						iR = (int)wR + sRed;
						iG = (int)wG + sGreen;
						iB = (int)wB + sBlue;
						
						if (iR < 0) iR = 0;
						else if (iR > 31) iR = 31;
						if (iG < 0) iG = 0;
						else if (iG > 63) iG = 63;
						if (iB < 0) iB = 0;
						else if (iB > 31) iB = 31;
						
						wTemp = (WORD)((iR<<11) | (iG<<5) | iB);
						if (wTemp != m_wColorKey)
							 pSrc[ix] = wTemp;
						else pSrc[ix] = (WORD)((iR<<11) | (iG<<5) | (iB+1));
				}	}
				pSrc += m_sPitch;
			}
			break;
			
		case 2:
			for (iy = 0; iy < m_wBitmapSizeY; iy++) 
			{	for (ix = 0; ix < m_wBitmapSizeX; ix++) 
				{	if (pSrc == NULL) return; 
					if (pSrc[ix] != m_wColorKey)	
					{	wR = (WORD)(pSrc[ix]&0x7C00)>>10;
						wG = (WORD)(pSrc[ix]&0x3E0)>>5;
						wB = (WORD)(pSrc[ix]&0x1F);
						iR = (int)wR + sRed;
						iG = (int)wG + sGreen;
						iB = (int)wB + sBlue;						
						if (iR < 0) iR = 0;
						else if (iR > 31) iR = 31;
						if (iG < 0) iG = 0;
						else if (iG > 31) iG = 31;
						if (iB < 0) iB = 0;
						else if (iB > 31) iB = 31;						
						wTemp = (WORD)((iR<<10) | (iG<<5) | iB);
						if (wTemp != m_wColorKey)
							 pSrc[ix] = wTemp;
						else pSrc[ix] = (WORD)((iR<<10) | (iG<<5) | (iB+1));				
				}	}
				pSrc += m_sPitch;
			}
			break;	
	}	}

	m_bOnCriticalSection = FALSE;
}

BOOL CSprite::_bCheckCollison(int sX, int sY, short sFrame, int msX, int msY)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
	int  ix, iy;
	WORD * pSrc;
	int  tX, tY;
	
	if( this == NULL ) return FALSE;
	if( m_stBrush == NULL ) return FALSE;
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return FALSE;
	if( m_bIsSurfaceEmpty == TRUE ) return FALSE;
	if( msX < m_pDDraw->m_rcClipArea.left+3 ) return FALSE;
	if( msX > m_pDDraw->m_rcClipArea.right-3 ) return FALSE;
	if( msY < m_pDDraw->m_rcClipArea.top+3 ) return FALSE;
	if( msY > m_pDDraw->m_rcClipArea.bottom-3 ) return FALSE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

  	dX = sX + pvx;
	dY = sY + pvy;

	if( msX < dX ) return FALSE;
	if( msX > dX+szx ) return FALSE;
	if( msY < dY ) return FALSE;
	if( msY > dY+szy ) return FALSE;

//	if (dX < m_pDDraw->m_rcClipArea.left+3) return FALSE;
//	if (dX+szx > m_pDDraw->m_rcClipArea.right-3) return FALSE;
//	if (dY < m_pDDraw->m_rcClipArea.top+3) return FALSE;
//	if (dY+szy > m_pDDraw->m_rcClipArea.bottom-3) return FALSE;

	if (dX < m_pDDraw->m_rcClipArea.left+3)
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left+3 - dX);
		szx = szx - (m_pDDraw->m_rcClipArea.left+3 - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return FALSE;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left+3;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right-3)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right-3);
		if (szx < 0) {
			m_rcBound.top = -1;
			return FALSE;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top+3)
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top+3 - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top+3 - dY);
		if (szy < 0) {
			m_rcBound.top = -1;
			return FALSE;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top+3;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom-3)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom-3);
		if (szy < 0) {
			m_rcBound.top = -1;
			return FALSE;
		}
	}
	
	SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);

	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	tX = dX;
	tY = dY;


//	pSrc += m_sPitch * ( msY - tY );
//	if( pSrc[msX-tX] != m_wColorKey ) return TRUE;
//	else return FALSE;

	if( msY < tY + 3 ) return FALSE;
	if( msX < tX + 3 ) return FALSE;
	pSrc += m_sPitch * ( msY - tY - 3 );
	for( iy=0 ; iy<=6 ; iy++ )
	{
		for( ix=msX-tX-3 ; ix<=msX-tX+3 ; ix++ )
		{
			if( pSrc[ix] != m_wColorKey ) return TRUE;
		}
		pSrc += m_sPitch;
	}
	return FALSE;
}

void CSprite::PutShiftSpriteFast(int sX, int sY, int shX, int shY, int sFrame, DWORD dwTime)
{
	short dX,dY,sx,sy,szx,szy,pvx,pvy;
 RECT rcRect;
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;

	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = 128;//m_stBrush[sFrame].szx;
	szy = 128;//m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;

	sx += shX;
	sy += shY;

  	dX = sX + pvx;
	dY = sY + pvy;

	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}

	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy <= 0) {
			m_rcBound.top = -1;
			return;
		}
	}
	
	m_dwRefTime = dwTime;

	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}

	//SetRect(&rcRect,  sx, sy, sx + szx, sy + szy); // our fictitious sprite bitmap is 
	//SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
	rcRect.left = sx;
	rcRect.top  = sy;
	rcRect.right  = sx + szx;
	rcRect.bottom = sy + szy;

	m_rcBound.left = dX;
	m_rcBound.top  = dY;
	m_rcBound.right  = dX + szx;
	m_rcBound.bottom = dY + szy;

	m_pDDraw->m_lpBackB4->BltFast( dX, dY, m_lpSurface, &rcRect, DDBLTFAST_NOCOLORKEY | DDBLTFAST_WAIT );

	m_bOnCriticalSection = FALSE;
}

void CSprite::PutRevTransSprite(int sX, int sY, int sFrame, DWORD dwTime, int alphaDepth)
{
	int  ix, iy;
	int  iR, iG, iB;
	WORD * pSrc, * pDst;
	int dX,dY,sx,sy,szx,szy,pvx,pvy;//,sTmp;
	
	if( this == NULL ) return;
	if( m_stBrush == NULL ) return;
	m_rcBound.top = -1; // Fix by Snoopy.... (Reco at mine)
	if ((m_iTotalFrame-1 < sFrame) || (sFrame < 0)) return;	
	m_bOnCriticalSection = TRUE;
	
	sx  = m_stBrush[sFrame].sx;
	sy  = m_stBrush[sFrame].sy;
	szx = m_stBrush[sFrame].szx;
	szy = m_stBrush[sFrame].szy;
	pvx = m_stBrush[sFrame].pvx;
	pvy = m_stBrush[sFrame].pvy;
	
	dX = sX + pvx;
	dY = sY + pvy;
		
	if (dX < m_pDDraw->m_rcClipArea.left) 								  
	{
		sx = sx	+ (m_pDDraw->m_rcClipArea.left - dX);							
		szx = szx - (m_pDDraw->m_rcClipArea.left - dX);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
		dX = (short)m_pDDraw->m_rcClipArea.left;
	}
	else if (dX+szx > m_pDDraw->m_rcClipArea.right)
	{
		szx = szx - ((dX+szx) - (short)m_pDDraw->m_rcClipArea.right);
		if (szx < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
		
	if (dY < m_pDDraw->m_rcClipArea.top) 								  
	{
		sy = sy	+ (m_pDDraw->m_rcClipArea.top - dY);
		szy = szy - (m_pDDraw->m_rcClipArea.top - dY);
		if (szy < 0) {	
			m_rcBound.top = -1;
			return;
		}
		dY = (short)m_pDDraw->m_rcClipArea.top;
	}
	else if (dY+szy > m_pDDraw->m_rcClipArea.bottom)
	{
		szy = szy - ((dY+szy) - (short)m_pDDraw->m_rcClipArea.bottom);
		if (szy < 0) {
			m_rcBound.top = -1;
			return;
		}
	}
		
	m_dwRefTime = dwTime;
		
	if (m_bIsSurfaceEmpty == TRUE) {
		if( _iOpenSprite() == FALSE ) return;
	}
	else {
		if (m_bAlphaEffect && (m_cAlphaDegree != G_cSpriteAlphaDegree)) {
			if (G_cSpriteAlphaDegree == 2) {
				_SetAlphaDegree();
			}
			else {
				_iCloseSprite();
				if( _iOpenSprite() == FALSE ) return;
			}
		}
	}
	
	SetRect(&m_rcBound, dX, dY, dX + szx, dY + szy);
		
	pSrc = (WORD *)m_pSurfaceAddr + sx + ((sy)*m_sPitch);
	pDst = (WORD *)m_pDDraw->m_pBackB4Addr + dX + ((dY)*m_pDDraw->m_sBackB4Pitch);
	
	if ((szx == 0) || (szy == 0)) return;
		
	switch (m_pDDraw->m_cPixelFormat) {
	case 1:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					iR = (int)m_pDDraw->m_lFadeRB[((pDst[ix]&0xF800)>>11)][((pSrc[ix]&0xF800)>>11) +alphaDepth];
					iG = (int)m_pDDraw->m_lFadeG[(pDst[ix]&0x7E0)>>5][((pSrc[ix]&0x7E0)>>5) +alphaDepth +alphaDepth];
					iB = (int)m_pDDraw->m_lFadeRB[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F) +alphaDepth];
					pDst[ix] = (WORD)((iR<<11) | (iG<<5) | iB);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
		
	case 2:
		iy =0;
		do {
			ix = 0;
			do {
				if (pSrc[ix] != m_wColorKey) {
					iR = (int)m_pDDraw->m_lFadeRB[(pDst[ix]&0x7C00)>>10][((pSrc[ix]&0x7C00)>>10) +alphaDepth];
					iG = (int)m_pDDraw->m_lFadeG[(pDst[ix]&0x3E0)>>5][((pSrc[ix]&0x3E0)>>5) +alphaDepth];
					iB = (int)m_pDDraw->m_lFadeRB[(pDst[ix]&0x1F)][(pSrc[ix]&0x1F) +alphaDepth];
					pDst[ix] = (WORD)((iR<<10) | (iG<<5) | iB);
				}
				
				ix++;
			} while (ix < szx);
			pSrc += m_sPitch;
			pDst += m_pDDraw->m_sBackB4Pitch;
			iy++;
		} while (iy < szy);
		break;
	}
	m_bOnCriticalSection = FALSE;
}


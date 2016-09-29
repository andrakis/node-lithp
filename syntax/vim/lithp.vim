" Vim syntax file
" Language:    Lithp
" Maintainer:  Julian "Andrakis" Thatcher (https://github.com/andrakis)
"
" Used the Lisp syntax file as a base.
" Note all syntax matching is currently correct, but it mostly works.

" ---------------------------------------------------------------------
"  Load Once: {{{1
" For vim-version 5.x: Clear all syntax items
" For vim-version 6.x: Quit when a syntax file was already loaded
if version < 600
  syntax clear
elseif exists("b:current_syntax")
  finish
endif

if version >= 600
 setlocal iskeyword=38,42,43,45,47-58,60-62,64-90,97-122,_
else
 set iskeyword=38,42,43,45,47-58,60-62,64-90,97-122,_
endif

" ---------------------------------------------------------------------
" Clusters: {{{1
syn cluster			lithpAtomCluster		contains=lithpAtomBarSymbol,lithpAtomList,lithpAtomNmbr0,lithpComment,lithpDecl,lithpFunc,lithpLeadWhite
syn cluster			lithpBaseListCluster	contains=lithpAtom,lithpAtomBarSymbol,lithpAtomMark,lithpBQList,lithpBarSymbol,lithpComment,lithpConcat,lithpDecl,lithpFunc,lithpKey,lithpList,lithpNumber,lithpEscapeSpecial,lithpSymbol,lithpVar,lithpLeadWhite
if exists("g:lithp_instring")
 syn cluster			lithpListCluster		contains=@lithpBaseListCluster,lithpString,lithpInString,lithpInStringString
else
 syn cluster			lithpListCluster		contains=@lithpBaseListCluster,lithpString
endif

syn case ignore

" ---------------------------------------------------------------------
" Lists: {{{1
syn match			lithpSymbol			contained			![^()'`,"% \t]\+!
syn match			lithpBarSymbol			contained			!|..\{-}|!
if exists("g:lithp_rainbow") && g:lithp_rainbow != 0
 syn region lithpParen0           matchgroup=hlLevel0 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen1
 syn region lithpParen1 contained matchgroup=hlLevel1 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen2
 syn region lithpParen2 contained matchgroup=hlLevel2 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen3
 syn region lithpParen3 contained matchgroup=hlLevel3 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen4
 syn region lithpParen4 contained matchgroup=hlLevel4 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen5
 syn region lithpParen5 contained matchgroup=hlLevel5 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen6
 syn region lithpParen6 contained matchgroup=hlLevel6 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen7
 syn region lithpParen7 contained matchgroup=hlLevel7 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen8
 syn region lithpParen8 contained matchgroup=hlLevel8 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen9
 syn region lithpParen9 contained matchgroup=hlLevel9 start="`\=(" end=")" skip="|.\{-}|" contains=@lithpListCluster,lithpParen0
else
 syn region lithpList			matchgroup=Delimiter start="("   skip="|.\{-}|"			matchgroup=Delimiter end=")"	contains=@lithpListCluster
 syn region lithpBQList			matchgroup=PreProc   start="`("  skip="|.\{-}|"			matchgroup=PreProc   end=")"		contains=@lithpListCluster
endif

" ---------------------------------------------------------------------
" Atoms: {{{1
" TODO: Support Lithp unquoted atoms
syn match lithpAtomMark			"'"
syn match lithpAtom			"'("me=e-1			contains=lithpAtomMark	nextgroup=lithpAtomList
syn match lithpAtom			"'[^ \t()]\+"			contains=lithpAtomMark
syn match lithpAtomBarSymbol		!'|..\{-}|!			contains=lithpAtomMark
syn region lithpAtom			start=+'"+			skip=+\\"+ end=+"+
syn region lithpAtomList			contained			matchgroup=Special start="("	skip="|.\{-}|" matchgroup=Special end=")"	contains=@lithpAtomCluster,lithpString,lithpEscapeSpecial
syn match lithpAtomNmbr			contained			"\<\d\+"
syn match lithpLeadWhite			contained			"^\s\+"

" ---------------------------------------------------------------------
" Standard Lisp Functions and Macros: {{{1
syn keyword lithpFunc		def				var
syn keyword lithpFunc		set				get
syn keyword lithpFunc		+				++
syn keyword lithpFunc		-				*
syn keyword lithpFunc		/				?
syn keyword lithpFunc		if				else
syn keyword lithpFunc		==				!=
syn keyword lithpFunc		<				<=
syn keyword lithpFunc		>				>=
syn keyword lithpFunc		!				and
syn keyword lithpFunc		or				assert
syn keyword lithpFunc		print				list
syn keyword lithpFunc		map				slice
syn keyword lithpFunc		quote				inspect
syn keyword lithpFunc		null				undefined
syn keyword lithpFunc		&				|
syn keyword lithpFunc		^				~
syn keyword lithpFunc		nl				match
syn keyword lithpFunc		replace				regex
syn keyword lithpFunc		split				head
syn keyword lithpFunc		tail				ht
syn keyword lithpFunc		index				length
syn keyword lithpFunc		flatten				call
syn keyword lithpFunc		scope				try
syn keyword lithpFunc		catch				throw
syn keyword lithpFunc		to-string			define
syn keyword lithpFunc		undefine			defined
syn keyword lithpFunc		get-def				definitions
syn keyword lithpFunc		platform
syn keyword lithpFunc		import				export
syn keyword lithpFunc		__dirname			__filename

syn match   lithpFunc		"\<c[ad]\+r\>"
" ---------------------------------------------------------------------
" Lisp Keywords (modifiers): {{{1
"syn keyword lithpKey		:abort				:from-end			:overwrite
syn keyword lithpKey		:dontknowwhatthisis

" ---------------------------------------------------------------------
" Standard Lisp Variables: {{{1
" syn keyword lithpVar		*applyhook*			*load-pathname*			*print-pprint-dispatch*
syn keyword lithpVar dontknowhwatthisis

" ---------------------------------------------------------------------
" Strings: {{{1
syn region			lithpString			start=+"+ skip=+\\\\\|\\"+ end=+"+	contains=@Spell
if exists("g:lithp_instring")
 syn region			lithpInString			keepend matchgroup=Delimiter start=+"(+rs=s+1 skip=+|.\{-}|+ matchgroup=Delimiter end=+)"+ contains=@lithpBaseListCluster,lithpInStringString
 syn region			lithpInStringString		start=+\\"+ skip=+\\\\+ end=+\\"+ contained
endif

" ---------------------------------------------------------------------
" Shared with Xlithp, Declarations, Macros, Functions: {{{1
"syn keyword lithpDecl		defmacro			do-all-symbols		labels
"syn keyword lithpDecl		defsetf				do-external-symbols	let
"syn keyword lithpDecl		deftype				do-symbols		locally
"syn keyword lithpDecl		defun				dotimes			macrolet
"syn keyword lithpDecl		do*				flet			multiple-value-bind
syn keyword lithpDecl		def

" ---------------------------------------------------------------------
" Numbers: supporting integers and floating point numbers {{{1
syn match lithpNumber		"-\=\(\.\d\+\|\d\+\(\.\d*\)\=\)\([dDeEfFlL][-+]\=\d\+\)\="
syn match lithpNumber		"-\=\(\d\+/\d\+\)"

syn match lithpEscapeSpecial		"\*\w[a-z_0-9-]*\*"
syn match lithpEscapeSpecial		!#|[^()'`,"; \t]\+|#!
syn match lithpEscapeSpecial		!#x\x\+!
syn match lithpEscapeSpecial		!#o\o\+!
syn match lithpEscapeSpecial		!#b[01]\+!
syn match lithpEscapeSpecial		!#\\[ -}\~]!
syn match lithpEscapeSpecial		!#[':][^()'`,"; \t]\+!
syn match lithpEscapeSpecial		!#([^()'`,"; \t]\+)!
syn match lithpEscapeSpecial		!#\\\%(Space\|Newline\|Tab\|Page\|Rubout\|Linefeed\|Return\|Backspace\)!
syn match lithpEscapeSpecial		"\<+[a-zA-Z_][a-zA-Z_0-9-]*+\>"

syn match lithpConcat		"\s\.\s"
syn match lithpParenError	")"

" ---------------------------------------------------------------------
" Comments: {{{1
syn cluster lithpCommentGroup	contains=lithpTodo,@Spell
syn match   lithpComment	"%.*$"				contains=@lithpCommentGroup
syn region  lithpCommentRegion	start="#|" end="|#"		contains=lithpCommentRegion,@lithpCommentGroup
syn keyword lithpTodo		contained			combak			combak:			todo			todo:

" ---------------------------------------------------------------------
" Synchronization: {{{1
syn sync lines=100

" ---------------------------------------------------------------------
" Define Highlighting: {{{1
" For version 5.7 and earlier: only when not done already
" For version 5.8 and later: only when an item doesn't have highlighting yet
if version >= 508
  command -nargs=+ HiLink hi def link <args>

  HiLink lithpCommentRegion	lithpComment
  HiLink lithpAtomNmbr		lithpNumber
  HiLink lithpAtomMark		lithpMark
  HiLink lithpInStringString	lithpString

  HiLink lithpAtom		Identifier
  HiLink lithpAtomBarSymbol	Special
  HiLink lithpBarSymbol		Special
  HiLink lithpComment		Comment
  HiLink lithpConcat		Statement
  HiLink lithpDecl		Statement
  HiLink lithpFunc		Statement
  HiLink lithpKey		Type
  HiLink lithpMark		Delimiter
  HiLink lithpNumber		Number
  HiLink lithpParenError		Error
  HiLink lithpEscapeSpecial	Type
  HiLink lithpString		String
  HiLink lithpTodo		Todo
  HiLink lithpVar		Statement

  if exists("g:lithp_rainbow") && g:lithp_rainbow != 0
   if &bg == "dark"
    hi def hlLevel0 ctermfg=red         guifg=red1
    hi def hlLevel1 ctermfg=yellow      guifg=orange1
    hi def hlLevel2 ctermfg=green       guifg=yellow1
    hi def hlLevel3 ctermfg=cyan        guifg=greenyellow
    hi def hlLevel4 ctermfg=magenta     guifg=green1
    hi def hlLevel5 ctermfg=red         guifg=springgreen1
    hi def hlLevel6 ctermfg=yellow      guifg=cyan1
    hi def hlLevel7 ctermfg=green       guifg=slateblue1
    hi def hlLevel8 ctermfg=cyan        guifg=magenta1
    hi def hlLevel9 ctermfg=magenta     guifg=purple1
   else
    hi def hlLevel0 ctermfg=red         guifg=red3
    hi def hlLevel1 ctermfg=darkyellow  guifg=orangered3
    hi def hlLevel2 ctermfg=darkgreen   guifg=orange2
    hi def hlLevel3 ctermfg=blue        guifg=yellow3
    hi def hlLevel4 ctermfg=darkmagenta guifg=olivedrab4
    hi def hlLevel5 ctermfg=red         guifg=green4
    hi def hlLevel6 ctermfg=darkyellow  guifg=paleturquoise3
    hi def hlLevel7 ctermfg=darkgreen   guifg=deepskyblue4
    hi def hlLevel8 ctermfg=blue        guifg=darkslateblue
    hi def hlLevel9 ctermfg=darkmagenta guifg=darkviolet
   endif
  endif

  delcommand HiLink
endif

let b:current_syntax = "lithp"

" ---------------------------------------------------------------------
" vim: ts=8 nowrap fdm=marker


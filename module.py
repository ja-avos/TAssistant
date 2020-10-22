import requests
from lxml import html
from lxml import etree as et
from lxml.cssselect import CSSSelector
import webbrowser

def getCredentials():
    with open('session.ses', 'r') as fi:
        content = fi.read()
        pairs = content.split('; ')
        val1 = pairs[0].split('=')
        val2 = pairs[1].split('=')
        return {val1[0]: val1[1], val2[0]:val2[1]}

def getDoc(text):
    return html.fromstring(text)

def getCourses():
    courses = {}
    URL = 'https://uniandespiloto.brightspace.com/d2l/le/manageCourses/search/6659'
    r = requests.get(URL, cookies=getCredentials())
    doc = getDoc(r.text)
    query = doc.find_class("d2l-grid-row")
    if len(query) > 0:
        print('Courses: ')
        for i in query:
            course_name = i.find_class('d2l-link')[0].text_content()
            linkC = i.find_class('d2l-link')[0].get('href').split('/')
            course_code = linkC[len(linkC)-1]
            courses[course_name] = course_code
            print('\t'+course_name+'\t'+course_code)
    else:
        print('No courses.')
    return courses

def getActivities(course):
    activities = {}
    URL = 'https://uniandespiloto.brightspace.com/d2l/lms/dropbox/admin/folders_manage.d2l?ou='
    r = requests.get(URL+course, cookies=getCredentials())
    doc = getDoc(r.text)
    sel = CSSSelector('div.d2l-foldername')
    query = sel(doc)
    print('Activities:')
    for i in query:
        activity_name = i.text_content().strip()
        linkA = i.find_class('d2l-link-inline')[0].get('href').split('=')
        activity_code = linkA[1].split('&')[0]
        activities[activity_name] = activity_code
        print('\t'+activity_name+'\t'+activity_code)
    return activities

def getStudents(activity, course):
    students = {}
    URL = 'https://uniandespiloto.brightspace.com/d2l/lms/dropbox/admin/mark/folder_submissions_users.d2l?db={0}&ou={1}'
    r = requests.get(URL.format(activity, course), cookies=getCredentials())
    doc = getDoc(r.text)
    sel = CSSSelector('.d_ggl2')
    selA = CSSSelector('a')
    selL = CSSSelector('label')
    query = sel(doc)
    print('Activities:')
    for i in query:
        ele = selA(i)[0]
        nameLbl = selL(i)[0]
        print(ele.get('id')[2:], nameLbl.text_content())
    return students

def downloadFiles():
    webbrowser.open('http://www.google.com')

#getCourses()
#getActivities()
#y = input('Activity?\n')
#getStudents('1534', '8190')
downloadFiles()